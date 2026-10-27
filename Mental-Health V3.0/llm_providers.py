"""Model providers for /chat. Pure standard library: no SDKs to install.

Pick one with environment variables (see .env.example):
  ANTHROPIC_API_KEY=...                       -> Claude (default model: claude-haiku-5-5)
  OPENAI_API_KEY=...  [MINDSENCE_LLM_BASE_URL] -> OpenAI or ANY OpenAI-compatible server
                                                  (Groq, OpenRouter, Together, LM Studio, vLLM, Ollama /v1 ...)
  MINDSENCE_LLM_PROVIDER=ollama               -> a local Ollama (optional; auto-detected if it is already running)
With nothing configured the app still works in "simple mode" (a built-in, offline responder in the browser).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODELS = {"anthropic": "claude-haiku-5-5", "openai": "gpt-4o-mini", "ollama": "qwen2.5:3b"}
# Models that run well on ordinary computers, best first. Qwen2.5 handles many languages better than most small models.
OLLAMA_PREFERRED = ("qwen2.5:3b", "llama3.2:3b", "qwen2.5:1.5b", "llama3.2:1b", "gemma2:2b", "qwen2.5:0.5b")
NOT_CHAT_MODELS = ("embed", "nomic", "bge", "minilm", "rerank")
LOCAL_HOSTS = ("localhost", "127.0.0.1", "[::1]", "0.0.0.0")
TIMEOUT = 60

_OLLAMA_CACHE = {"at": 0.0, "up": False, "url": None, "models": [], "sizes": {}}


class LLMError(Exception):
    def __init__(self, code, status=502, detail=""):
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code, self.status, self.detail = code, status, detail


# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
def _ollama_probe(base, now=None):
    """Cheap, cached look at a local Ollama: is it running, and which models are installed?"""
    now = time.time() if now is None else now
    if _OLLAMA_CACHE["url"] == base and now - _OLLAMA_CACHE["at"] < 20:
        return _OLLAMA_CACHE["up"], _OLLAMA_CACHE["models"]
    up, models, sizes = False, [], {}
    try:
        with urllib.request.urlopen(base.rstrip("/") + "/api/tags", timeout=0.6) as resp:
            up = True
            data = json.loads(resp.read(1_000_000).decode("utf-8", "replace"))
            for m in (data.get("models") or []):
                if isinstance(m, dict) and m.get("name"):
                    models.append(m["name"]); sizes[m["name"]] = m.get("size") or 0
    except Exception:
        pass
    _OLLAMA_CACHE.update(at=now, up=up, url=base, models=models, sizes=sizes)
    return up, models


def _ollama_up(base, now=None):
    return _ollama_probe(base, now)[0]


def _ollama_models(base, now=None):
    return _ollama_probe(base, now)[1]


def total_ram_gb():
    """Installed memory in GB, or None if it cannot be read."""
    try:
        if os.name == "nt":
            import ctypes

            class MemStatus(ctypes.Structure):
                _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong), ("total", ctypes.c_ulonglong), ("avail", ctypes.c_ulonglong),
                            ("tpf", ctypes.c_ulonglong), ("apf", ctypes.c_ulonglong), ("tv", ctypes.c_ulonglong), ("av", ctypes.c_ulonglong),
                            ("ave", ctypes.c_ulonglong)]
            st = MemStatus(); st.length = ctypes.sizeof(MemStatus)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st))
            return st.total / 2 ** 30
        if sys.platform == "darwin":
            import subprocess
            return int(subprocess.check_output(["sysctl", "-n", "hw.memsize"]).strip()) / 2 ** 30
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) / 2 ** 20
    except Exception:
        pass
    return None


def pick_ollama_model(installed, ram_gb=None, strict=False):
    """The best chat model among those already downloaded, or None.

    `installed` holds names or (name, size_in_bytes) pairs. Embedding models are ignored. A model must fit comfortably in
    memory (its file size at most 60% of RAM) when both numbers are known. Ranking: the known good small multilingual
    models first (OLLAMA_PREFERRED order), then anything else, bigger before smaller. With strict=False, if nothing fits
    the smallest chat model is still returned (it is better than no AI); strict=True returns None instead (used to decide to download one)."""
    cands = []
    for item in installed or []:
        name, size = (item if isinstance(item, (tuple, list)) else (item, 0))
        if name and not any(bad in name.lower() for bad in NOT_CHAT_MODELS):
            cands.append((name, size or 0))
    if not cands:
        return None
    fits = [c for c in cands if not (ram_gb and c[1] and c[1] > 0.6 * ram_gb * 2 ** 30)]
    if not fits:
        return None if strict else min(cands, key=lambda c: c[1] or 1e18)[0]

    def rank(c):
        name, size = c
        for i, want in enumerate(OLLAMA_PREFERRED):
            if name == want or name.startswith(want + "-"):
                return (0, i, 0)
        return (1, 0, -size)
    return min(fits, key=rank)[0]


def _installed(base):
    """[(name, size)] of the downloaded Ollama models (sizes are 0 if unknown)."""
    names = _ollama_models(base)
    sizes = _OLLAMA_CACHE.get("sizes") or {}
    return [(n, sizes.get(n, 0)) for n in names]


_RAM = {}


def _ram():
    if "v" not in _RAM:
        _RAM["v"] = total_ram_gb()
    return _RAM["v"]


def _is_local(url):
    return any(h in (url or "") for h in LOCAL_HOSTS)


def get_llm_config(env):
    """Resolve the provider from environment variables. Re-read on every call (cheap)."""
    choice = (env.get("MINDSENCE_LLM_PROVIDER") or "auto").strip().lower()
    model_override = (env.get("MINDSENCE_LLM_MODEL") or "").strip()
    anthropic_key = (env.get("ANTHROPIC_API_KEY") or "").strip()
    openai_key = (env.get("OPENAI_API_KEY") or env.get("MINDSENCE_LLM_API_KEY") or "").strip()
    base_url = (env.get("MINDSENCE_LLM_BASE_URL") or "").strip().rstrip("/")
    ollama_url = (env.get("OLLAMA_HOST") or env.get("MINDSENCE_OLLAMA_URL") or "http://127.0.0.1:11434").strip().rstrip("/")
    if not ollama_url.startswith("http"):
        ollama_url = "http://" + ollama_url

    if choice == "auto":
        if anthropic_key:
            choice = "anthropic"
        elif openai_key or base_url:
            choice = "openai"
        elif _ollama_up(ollama_url) and (model_override or pick_ollama_model(_installed(ollama_url), _ram())):
            choice = "ollama"                          # running AND has a model: otherwise every reply would fail
        else:
            choice = "none"

    if choice == "anthropic":
        if not anthropic_key:
            return _none("ANTHROPIC_API_KEY is not set")
        model = model_override or DEFAULT_MODELS["anthropic"]
        return {"provider": "anthropic", "model": model, "api_key": anthropic_key, "base_url": ANTHROPIC_URL,
                "mode": "cloud", "label": "Claude"}
    if choice == "openai":
        base = base_url or "https://api.openai.com/v1"
        model = model_override or DEFAULT_MODELS["openai"]
        return {"provider": "openai", "model": model, "api_key": openai_key, "base_url": base,
                "mode": "local" if _is_local(base) else "cloud", "label": model}
    if choice == "ollama":
        installed = _installed(ollama_url)
        picked = pick_ollama_model(installed, _ram())
        model = model_override or picked or DEFAULT_MODELS["ollama"]
        if model_override and installed and picked and not any(n == model_override or n.startswith(model_override + "-") or (":" not in model_override and n.split(":")[0] == model_override) for n, _ in installed):
            model = picked                         # the configured model is not downloaded here: use what is, instead of failing
        return {"provider": "ollama", "model": model, "api_key": "", "base_url": ollama_url,
                "mode": "local", "label": model}
    return _none("no model configured")


def _none(reason):
    return {"provider": "none", "model": None, "api_key": "", "base_url": None, "mode": "none",
            "label": "Simple mode", "reason": reason}


def public_info(cfg):
    """What /health may reveal. Never the key or the URL."""
    return {"provider": cfg["provider"], "mode": cfg["mode"], "model": cfg["model"], "label": cfg["label"]}


def token_budget(lang, base):
    """Non-Latin scripts burn several times more tokens per word; avoid cutting replies mid-sentence."""
    code = (lang or "en").split("-")[0].lower()
    if code in ("en",):
        factor = 1.0
    elif code in ("es", "fr", "de", "pt", "it", "nl", "id", "tr", "pl", "vi", "sv"):
        factor = 1.4
    else:
        factor = 3.0
    return max(64, min(int(base * factor), 700))


# ------------------------------------------------------------------
# HTTP helpers
# ------------------------------------------------------------------
def _open(url, headers, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json", **headers}, method="POST")
    try:
        return urllib.request.urlopen(req, timeout=TIMEOUT)
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read(600).decode("utf-8", "replace")
        except Exception:
            pass
        if exc.code in (401, 403):
            raise LLMError("auth", 502, "the API key was rejected")
        if exc.code == 429:
            raise LLMError("rate_limited", 503, "the model provider is rate limiting requests")
        raise LLMError("provider_error", 502, f"HTTP {exc.code} {body}".strip())
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise LLMError("unreachable", 502, str(getattr(exc, "reason", exc)))


def _open_with_param_fallback(url, headers, payload, swaps):
    """Some providers reject a parameter name (e.g. OpenAI's newer models want max_completion_tokens).
    On a 400 that names the parameter, retry once with the alternative."""
    try:
        return _open(url, headers, payload)
    except LLMError as err:
        if err.code != "provider_error" or "HTTP 400" not in err.detail:
            raise
        retry = dict(payload)
        changed = False
        for old, new in swaps:
            if old in payload and old in err.detail:      # look at the ORIGINAL payload so a swap is never swapped back
                value = retry.pop(old)
                if new:
                    retry[new] = value
                changed = True
        if not changed:
            raise
        return _open(url, headers, retry)


def _sse_data(resp):
    for raw in resp:
        line = raw.decode("utf-8", "replace").strip()
        if line.startswith("data:"):
            data = line[5:].strip()
            if data:
                yield data


# ------------------------------------------------------------------
# Streaming implementations: each yields text pieces
# ------------------------------------------------------------------
def _stream_anthropic(cfg, system, messages, max_tokens, temperature):
    payload = {"model": cfg["model"], "max_tokens": max_tokens, "system": system,
               "messages": messages, "stream": True, "temperature": temperature}
    headers = {"x-api-key": cfg["api_key"], "anthropic-version": ANTHROPIC_VERSION}
    with _open_with_param_fallback(cfg["base_url"], headers, payload, [("temperature", None)]) as resp:
        for data in _sse_data(resp):
            try:
                ev = json.loads(data)
            except ValueError:
                continue
            kind = ev.get("type")
            if kind == "content_block_delta":
                text = (ev.get("delta") or {}).get("text")
                if text:
                    yield text
            elif kind == "error":
                raise LLMError("provider_error", 502, str((ev.get("error") or {}).get("message", "")))
            elif kind == "message_stop":
                break


def _stream_openai(cfg, system, messages, max_tokens, temperature):
    base = cfg["base_url"]
    uses_new_name = "api.openai.com" in base
    payload = {"model": cfg["model"], "stream": True, "temperature": temperature,
               "messages": [{"role": "system", "content": system}] + messages}
    payload["max_completion_tokens" if uses_new_name else "max_tokens"] = max_tokens
    headers = {"Authorization": f"Bearer {cfg['api_key']}"} if cfg["api_key"] else {}
    swaps = [("max_tokens", "max_completion_tokens"), ("max_completion_tokens", "max_tokens"), ("temperature", None)]
    with _open_with_param_fallback(base + "/chat/completions", headers, payload, swaps) as resp:
        for data in _sse_data(resp):
            if data == "[DONE]":
                break
            try:
                ev = json.loads(data)
            except ValueError:
                continue
            if ev.get("error"):
                raise LLMError("provider_error", 502, str((ev["error"] or {}).get("message", "")))
            for choice in ev.get("choices") or []:
                text = (choice.get("delta") or {}).get("content")
                if text:
                    yield text


def _stream_ollama(cfg, system, messages, max_tokens, temperature):
    payload = {"model": cfg["model"], "stream": True, "keep_alive": "1h",
               "messages": [{"role": "system", "content": system}] + messages,
               "options": {"temperature": temperature, "num_predict": max_tokens}}
    with _open(cfg["base_url"] + "/api/chat", {}, payload) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            if ev.get("error"):
                raise LLMError("provider_error", 502, str(ev["error"]))
            text = (ev.get("message") or {}).get("content")
            if text:
                yield text
            if ev.get("done"):
                break


def warm_up(cfg):
    """Load a local model into memory now, so the first real reply is not slow. Failures are harmless."""
    if cfg.get("provider") != "ollama":
        return False
    try:
        payload = {"model": cfg["model"], "prompt": "", "stream": False, "keep_alive": "1h"}
        with _open(cfg["base_url"] + "/api/generate", {}, payload) as resp:
            resp.read(1000)
        return True
    except Exception:
        return False


_STREAMERS = {"anthropic": _stream_anthropic, "openai": _stream_openai, "ollama": _stream_ollama}


def stream_chat(cfg, system, messages, max_tokens, temperature):
    """Generator of text pieces. Raises LLMError (possibly on the first next())."""
    streamer = _STREAMERS.get(cfg["provider"])
    if streamer is None:
        raise LLMError("no_llm", 503, cfg.get("reason", ""))
    return streamer(cfg, system, messages, max_tokens, temperature)
