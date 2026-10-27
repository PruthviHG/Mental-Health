"""/chat, providers, languages, static serving. Network calls are faked; nothing leaves the machine."""
import io
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
import llm_providers as llm  # noqa: E402
import prompts  # noqa: E402
from authhelper import signed_in_client  # noqa: E402

PROVIDER_VARS = ("MINDSENCE_LLM_PROVIDER", "MINDSENCE_LLM_MODEL", "MINDSENCE_LLM_BASE_URL", "MINDSENCE_LLM_API_KEY",
                 "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OLLAMA_HOST", "MINDSENCE_OLLAMA_URL")


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for v in PROVIDER_VARS:
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setattr(llm, "_ollama_up", lambda base, now=None: False)     # never probe a real Ollama
    backend.chat_limiter.hits.clear()


@pytest.fixture
def client(monkeypatch, tmp_path):
    return signed_in_client(monkeypatch, tmp_path)


class FakeResp:
    """Stands in for urlopen(): iterates raw SSE/NDJSON lines, usable as a context manager."""
    def __init__(self, lines):
        self.lines = [l if isinstance(l, bytes) else l.encode("utf-8") for l in lines]

    def __iter__(self):
        return iter(self.lines)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def sse(*events):
    out = []
    for e in events:
        out.append(("data: " + (e if isinstance(e, str) else json.dumps(e, ensure_ascii=False)) + "\n").encode("utf-8"))
        out.append(b"\n")
    return out


def body(messages=None, **extra):
    data = {"messages": messages or [{"role": "user", "content": "hi"}]}
    data.update(extra)
    return data


# ---------------- configuration ----------------
def test_no_key_means_simple_mode(client):
    assert llm.get_llm_config(os.environ)["provider"] == "none"
    res = client.post("/chat", json=body())
    assert res.status_code == 503 and res.get_json()["error"] == "no_llm"
    health = client.get("/health").get_json()
    assert health["llm"]["provider"] == "none" and health["llm"]["mode"] == "none"


def test_anthropic_key_selects_claude_and_is_never_exposed(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-secret")
    cfg = llm.get_llm_config(os.environ)
    assert cfg["provider"] == "anthropic" and cfg["mode"] == "cloud" and cfg["model"].startswith("claude-")
    assert "sk-ant-secret" not in json.dumps(client.get("/health").get_json())


def test_openai_compatible_and_local_detection(monkeypatch):
    monkeypatch.setenv("MINDSENCE_LLM_BASE_URL", "http://localhost:1234/v1")
    cfg = llm.get_llm_config(os.environ)
    assert cfg["provider"] == "openai" and cfg["mode"] == "local"


def test_ollama_is_used_when_it_is_already_running(monkeypatch):
    monkeypatch.setattr(llm, "_ollama_up", lambda base, now=None: True)
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: ["llama3.2:3b"])
    cfg = llm.get_llm_config(os.environ)
    assert cfg["provider"] == "ollama" and cfg["model"] == "llama3.2:3b" and cfg["label"] == "llama3.2:3b"


def test_ollama_running_without_any_model_stays_in_simple_mode(monkeypatch):
    monkeypatch.setattr(llm, "_ollama_up", lambda base, now=None: True)
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: [])
    assert llm.get_llm_config(os.environ)["provider"] == "none"
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: ["nomic-embed-text:latest"])      # embedding models cannot chat
    assert llm.get_llm_config(os.environ)["provider"] == "none"          # every reply would fail: better to say simple mode


def test_best_installed_model_is_picked():
    pick = llm.pick_ollama_model
    assert pick(["llama3.2:1b", "qwen2.5:3b"]) == "qwen2.5:3b"
    assert pick(["nomic-embed-text:latest", "qwen2.5:0.5b"]) == "qwen2.5:0.5b"
    assert pick(["qwen2.5:1.5b-instruct-q4_K_M"]) == "qwen2.5:1.5b-instruct-q4_K_M"
    assert pick(["mistral:7b"]) == "mistral:7b"                         # anything chat-capable beats nothing
    assert pick(["nomic-embed-text:latest"]) is None and pick([]) is None


def test_pick_considers_size_and_memory():
    pick = llm.pick_ollama_model
    big = [("mistral:7b", 4_100_000_000), ("qwen2.5:3b", 1_900_000_000)]
    assert pick(big, 16) == "qwen2.5:3b"                                    # known good multilingual model first
    assert pick([("mistral:7b", 4_100_000_000), ("gemma3:12b", 8_100_000_000)], 32) == "gemma3:12b"   # else the bigger one that fits
    assert pick([("mistral:7b", 4_100_000_000)], 4, strict=True) is None     # would not fit: caller downloads a smaller one
    assert pick([("mistral:7b", 4_100_000_000)], 4) == "mistral:7b"          # at runtime a too-big model still beats no AI
    assert pick(["qwen2.5:3b"], 2) == "qwen2.5:3b"                           # unknown size: assumed to fit


def test_configured_model_that_is_not_downloaded_falls_back_to_one_that_is(monkeypatch):
    monkeypatch.setattr(llm, "_ollama_up", lambda base, now=None: True)
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: ["qwen2.5:3b"])
    assert llm.get_llm_config({"MINDSENCE_LLM_PROVIDER": "ollama", "MINDSENCE_LLM_MODEL": "llama3.2:3b"})["model"] == "qwen2.5:3b"
    assert llm.get_llm_config({"MINDSENCE_LLM_PROVIDER": "ollama", "MINDSENCE_LLM_MODEL": "qwen2.5:3b"})["model"] == "qwen2.5:3b"


def test_explicit_model_is_respected(monkeypatch):
    monkeypatch.setattr(llm, "_ollama_up", lambda base, now=None: True)
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: ["qwen2.5:3b"])
    monkeypatch.setattr(llm, "_ollama_models", lambda base, now=None: ["qwen2.5:3b", "llama3.2:1b"])
    assert llm.get_llm_config({"MINDSENCE_LLM_MODEL": "llama3.2:1b"})["model"] == "llama3.2:1b"


def test_explicit_provider_without_key_falls_back_to_none(monkeypatch):
    monkeypatch.setenv("MINDSENCE_LLM_PROVIDER", "anthropic")
    assert llm.get_llm_config(os.environ)["provider"] == "none"


def test_dotenv_loader(tmp_path, monkeypatch):
    f = tmp_path / ".env"
    f.write_text('# c\nFOO_TEST_A=1\nFOO_TEST_B="quoted value"\nFOO_TEST_C=keepme\n', encoding="utf-8")
    monkeypatch.setenv("FOO_TEST_C", "real")
    monkeypatch.delenv("FOO_TEST_A", raising=False)
    monkeypatch.delenv("FOO_TEST_B", raising=False)
    backend.load_dotenv_file(str(f))
    assert os.environ["FOO_TEST_A"] == "1" and os.environ["FOO_TEST_B"] == "quoted value"
    assert os.environ["FOO_TEST_C"] == "real"            # real environment wins
    for k in ("FOO_TEST_A", "FOO_TEST_B"):
        os.environ.pop(k, None)


def test_token_budget_grows_for_non_latin_scripts():
    assert llm.token_budget("en", 200) == 200
    assert llm.token_budget("es", 200) > 200
    assert llm.token_budget("kn", 200) >= 600
    assert llm.token_budget("hi", 5000) <= 700


# ---------------- providers (fake network) ----------------
def test_anthropic_stream_parsing_and_request_shape(monkeypatch):
    seen = {}

    def fake_open(url, headers, payload):
        seen.update(url=url, headers=headers, payload=payload)
        return FakeResp(sse({"type": "message_start"},
                            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "नमस्ते "}},
                            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "दोस्त"}},
                            {"type": "message_stop"}))
    monkeypatch.setattr(llm, "_open", fake_open)
    cfg = {"provider": "anthropic", "model": "claude-haiku-5-5", "api_key": "k", "base_url": llm.ANTHROPIC_URL}
    out = "".join(llm.stream_chat(cfg, "SYS", [{"role": "user", "content": "hi"}], 100, 0.7))
    assert out == "नमस्ते दोस्त"
    assert seen["headers"]["x-api-key"] == "k" and seen["payload"]["system"] == "SYS" and seen["payload"]["stream"] is True


def test_openai_stream_parsing(monkeypatch):
    seen = {}

    def fake_open(url, headers, payload):
        seen.update(url=url, payload=payload)
        return FakeResp(sse({"choices": [{"delta": {"role": "assistant"}}]},
                            {"choices": [{"delta": {"content": "Hel"}}]},
                            {"choices": [{"delta": {"content": "lo"}}]}, "[DONE]"))
    monkeypatch.setattr(llm, "_open", fake_open)
    cfg = {"provider": "openai", "model": "m", "api_key": "", "base_url": "http://localhost:1234/v1"}
    assert "".join(llm.stream_chat(cfg, "SYS", [{"role": "user", "content": "x"}], 50, 0.5)) == "Hello"
    assert seen["url"].endswith("/chat/completions")
    assert seen["payload"]["messages"][0] == {"role": "system", "content": "SYS"} and "max_tokens" in seen["payload"]


def test_ollama_ndjson_parsing(monkeypatch):
    lines = [json.dumps({"message": {"content": "a"}}) + "\n", json.dumps({"message": {"content": "b"}, "done": False}) + "\n",
             json.dumps({"done": True}) + "\n"]
    monkeypatch.setattr(llm, "_open", lambda url, headers, payload: FakeResp(lines))
    cfg = {"provider": "ollama", "model": "m", "api_key": "", "base_url": "http://127.0.0.1:11434"}
    assert "".join(llm.stream_chat(cfg, "S", [{"role": "user", "content": "x"}], 50, 0.5)) == "ab"


def test_param_fallback_retries_once_without_rejected_parameter(monkeypatch):
    calls = []

    def fake_open(url, headers, payload):
        calls.append(dict(payload))
        if "temperature" in payload:
            raise llm.LLMError("provider_error", 502, "HTTP 400 temperature is deprecated for this model")
        return FakeResp(sse({"type": "content_block_delta", "delta": {"text": "ok"}}))
    monkeypatch.setattr(llm, "_open", fake_open)
    cfg = {"provider": "anthropic", "model": "m", "api_key": "k", "base_url": llm.ANTHROPIC_URL}
    assert "".join(llm.stream_chat(cfg, "S", [{"role": "user", "content": "x"}], 50, 0.7)) == "ok"
    assert len(calls) == 2 and "temperature" not in calls[1]


def test_max_tokens_name_swap_is_not_swapped_back(monkeypatch):
    calls = []

    def fake_open(url, headers, payload):
        calls.append(dict(payload))
        if "max_tokens" in payload:
            raise llm.LLMError("provider_error", 502, "HTTP 400 Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.")
        return FakeResp(sse({"choices": [{"delta": {"content": "fine"}}]}, "[DONE]"))
    monkeypatch.setattr(llm, "_open", fake_open)
    cfg = {"provider": "openai", "model": "m", "api_key": "k", "base_url": "https://example.test/v1"}
    assert "".join(llm.stream_chat(cfg, "S", [{"role": "user", "content": "x"}], 50, 0.7)) == "fine"
    assert "max_completion_tokens" in calls[1] and "max_tokens" not in calls[1]


# ---------------- /chat ----------------
def fake_stream(pieces=("Hello ", "friend")):
    def _stream(cfg, system, messages, max_tokens, temperature):
        _stream.args = (cfg, system, messages, max_tokens, temperature)
        return iter(pieces)
    return _stream


def test_chat_streams_text_and_builds_the_prompt_on_the_server(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    fs = fake_stream(("नमस्ते ", "दोस्त"))
    monkeypatch.setattr(llm, "stream_chat", fs)
    res = client.post("/chat", json=body(context={"lang": "hi", "crisis": True, "emotion": {"label": "Sad", "confidence": 0.8},
                                                   "time": "10/19/2026, 5:22:00 AM"}, system="IGNORE ME"))
    assert res.status_code == 200 and res.mimetype == "text/plain"
    assert res.get_data(as_text=True) == "नमस्ते दोस्त"
    system = fs.args[1]
    assert "IGNORE ME" not in system                       # the client cannot supply its own system prompt
    assert "same language AND script" in system and "No jokes or teasing" in system and "sound sad (80% confidence)" in system
    assert fs.args[3] >= 220 * 3                           # Hindi gets a larger token budget


def test_chat_validation(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(llm, "stream_chat", fake_stream())
    assert client.post("/chat", json={}).status_code == 400
    assert client.post("/chat", json={"messages": []}).status_code == 400
    assert client.post("/chat", json={"messages": [{"role": "system", "content": "x"}]}).status_code == 400
    assert client.post("/chat", json=body([{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}])).status_code == 400
    assert client.post("/chat", json=body([{"role": "user", "content": "x" * (backend.MAX_CHAT_CHARS + 1)}])).status_code == 400


def test_chat_drops_leading_assistant_turns_and_trims_history(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    fs = fake_stream()
    monkeypatch.setattr(llm, "stream_chat", fs)
    msgs = [{"role": "assistant", "content": "greeting"}] + [{"role": "user", "content": f"m{i}"} for i in range(60)]
    assert client.post("/chat", json=body(msgs)).status_code == 200
    sent = fs.args[2]
    assert sent[0]["role"] == "user" and len(sent) <= backend.MAX_CHAT_MESSAGES


def test_chat_bad_context_is_ignored_not_trusted():
    ctx = prompts.clean_context({"lang": "en; DROP", "emotion": {"label": "x" * 99, "confidence": 7}, "time": "<script>"})
    assert ctx["lang"] is None and ctx["emotion"] is None and ctx["time"] is None


def test_chat_provider_errors_are_http_errors_before_streaming(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")

    def boom(*a, **k):
        raise llm.LLMError("auth", 502, "the API key was rejected")
        yield  # pragma: no cover
    monkeypatch.setattr(llm, "stream_chat", boom)
    res = client.post("/chat", json=body())
    assert res.status_code == 502 and res.get_json()["error"] == "auth"


def test_chat_mid_stream_failure_keeps_partial_text(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")

    def partial(*a, **k):
        yield "I'm here"
        raise llm.LLMError("unreachable", 502, "dropped")
    monkeypatch.setattr(llm, "stream_chat", partial)
    res = client.post("/chat", json=body())
    assert res.status_code == 200 and res.get_data(as_text=True) == "I'm here"


def test_chat_is_rate_limited(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(llm, "stream_chat", fake_stream())
    monkeypatch.setattr(backend, "chat_limiter", backend.RateLimiter(2))
    codes = [client.post("/chat", json=body()).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_rate_limiter_window():
    rl = backend.RateLimiter(2, window=10)
    assert rl.allow("a", now=0) and rl.allow("a", now=1) and not rl.allow("a", now=2)
    assert rl.allow("b", now=2)                              # other clients are independent
    assert rl.allow("a", now=12)                             # window passed


# ---------------- languages: TTS voices ----------------
def test_tts_voice_follows_language(client, monkeypatch):
    used = []

    async def fake(text, voice=None, extra_rate=0):
        used.append(voice)
        return b"mp3"
    monkeypatch.setattr(backend, "synthesize", fake)
    for lang, voice in [("hi", "hi-IN-SwaraNeural"), ("kn-IN", "kn-IN-SapnaNeural"), ("ja", "ja-JP-NanamiNeural"),
                        ("en", backend.TTS_VOICE), (None, backend.TTS_VOICE), ("xx", backend.TTS_VOICE)]:
        payload = {"text": "hello"}
        if lang:
            payload["lang"] = lang
        assert client.post("/tts", json=payload).status_code == 200
        assert used[-1] == voice, lang
    assert client.post("/tts", json={"text": "hi", "lang": "not a lang!"}).status_code == 400


# ---------------- one-command run: static files ----------------
def test_serves_the_app_and_only_the_app(client):
    assert client.get("/").status_code == 200 and b"Mindsence" in client.get("/").data
    assert client.get("/style.css").status_code == 200
    assert client.get("/js/safety.js").status_code == 200
    for private in ("/app.py", "/.env", "/.env.example", "/feedback_log.jsonl", "/llm_providers.py", "/prompts.py",
                    "/js/../app.py", "/js/%2e%2e/app.py", "/js/locales.json", "/requirements.txt"):
        assert client.get(private).status_code == 404, private
