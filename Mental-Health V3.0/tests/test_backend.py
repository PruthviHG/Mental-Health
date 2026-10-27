import io
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
from authhelper import signed_in_client  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "FEEDBACK_FILE", str(tmp_path / "feedback.jsonl"))
    for k in ("GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "MINDSENCE_SMTP_HOST", "MINDSENCE_FEEDBACK_TO"):
        monkeypatch.delenv(k, raising=False)
    import mailer
    monkeypatch.setattr(mailer, "relay", lambda *a, **k: None)          # never touch the network in tests
    monkeypatch.setattr(backend, "FEEDBACK_ASYNC", False)
    monkeypatch.setattr(backend, "FEEDBACK_RETRY_SECONDS", (0,))
    backend.feedback_limit.hits.clear()
    return signed_in_client(monkeypatch, tmp_path)


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


# ---- /tts ----
def test_tts_requires_text(client):
    assert client.post("/tts", json={"text": "  "}).status_code == 400


def test_tts_rejects_long_text(client):
    res = client.post("/tts", json={"text": "a" * (backend.MAX_TTS_CHARS + 1)})
    assert res.status_code == 400


def test_tts_returns_audio(client, monkeypatch):
    async def fake(text, voice=None, extra_rate=0):
        return b"ID3-fake-mp3"
    monkeypatch.setattr(backend, "synthesize", fake)
    res = client.post("/tts", json={"text": "hello"})
    assert res.status_code == 200
    assert res.mimetype == "audio/mpeg"
    assert res.data == b"ID3-fake-mp3"


def test_tts_failure_is_502(client, monkeypatch):
    async def boom(text, voice=None, extra_rate=0):
        raise RuntimeError("offline")
    monkeypatch.setattr(backend, "synthesize", boom)
    assert client.post("/tts", json={"text": "hello"}).status_code == 502


# ---- /feedback ----
def test_feedback_saved(client):
    res = client.post("/feedback", json={"email": "a@b.co", "text": "love it"})
    assert res.status_code == 200
    with open(backend.FEEDBACK_FILE, encoding="utf-8") as f:
        entry = json.loads(f.readline())
    assert entry["email"] == "a@b.co" and entry["text"] == "love it"


def test_feedback_requires_text(client):
    assert client.post("/feedback", json={"email": "a@b.co"}).status_code == 400


def test_feedback_rejects_bad_email(client):
    assert client.post("/feedback", json={"email": "nope", "text": "hi"}).status_code == 400


def test_feedback_works_without_email(client, monkeypatch):
    import mailer
    monkeypatch.setattr(mailer, "relay", lambda *a, **k: None)
    assert client.post("/feedback", json={"text": "no contact address"}).status_code == 200


def test_feedback_uses_the_built_in_relay_when_no_gmail_is_set(client, monkeypatch):
    import mailer
    sent = []
    monkeypatch.setattr(mailer, "relay", lambda to, subject, text, reply_to=None, timeout=20: sent.append((to, subject, text, reply_to)))
    monkeypatch.setattr(mailer, "send", lambda *a, **k: (_ for _ in ()).throw(AssertionError("SMTP must not be used")))
    res = client.post("/feedback", json={"email": "u@x.co", "text": "no terminal setup needed"})
    assert res.status_code == 200 and len(sent) == 1
    assert sent[0][0] == mailer.feedback_inbox() and sent[0][3] == "u@x.co" and "no terminal setup" in sent[0][2]
    assert sent[0][0] not in res.get_data(as_text=True)


def test_relay_activation_and_failure_are_reported_not_hidden(monkeypatch):
    import io, mailer, urllib.request
    class R(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): pass
    for body, exc in ((b'{"success":"true"}', None), (b'{"success":"false","message":"This form needs Activation."}', mailer.NeedsActivation), (b'{"success":"false","message":"nope"}', RuntimeError)):
        monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=0, context=None, b=body: R(b))
        if exc is None:
            mailer.relay("a@b.co", "s", "t")
        else:
            with pytest.raises(exc):
                mailer.relay("a@b.co", "s", "t")


def test_feedback_is_emailed_and_the_inbox_is_not_leaked(client, monkeypatch):
    import mailer
    sent = []
    monkeypatch.setenv("GMAIL_ADDRESS", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop")
    monkeypatch.setattr(mailer, "send", lambda to, subject, text, reply_to=None, env=None: sent.append((to, subject, text, reply_to)))
    monkeypatch.setattr(mailer, "relay", lambda *a, **k: (_ for _ in ()).throw(AssertionError("relay must not be used when Gmail is set")))
    res = client.post("/feedback", json={"email": "a@b.co", "text": "The games are great\nBcc: evil@x.com"})
    assert res.status_code == 200
    assert len(sent) == 1
    to, subject, text, reply_to = sent[0]
    assert to == mailer.feedback_inbox() and "@gmail.com" in to
    assert "\n" not in subject and "Bcc" not in subject.split("]")[0]
    assert reply_to == "a@b.co" and "The games are great" in text and "Account:" in text
    assert to not in res.get_data(as_text=True)
    assert client.get("/health").status_code == 200 and to not in client.get("/health").get_data(as_text=True)


def test_feedback_retries_then_still_saved(client, monkeypatch):
    import mailer
    calls = []
    monkeypatch.setenv("GMAIL_ADDRESS", "sender@gmail.com")
    monkeypatch.setenv("GMAIL_APP_PASSWORD", "x")
    monkeypatch.setattr(backend, "FEEDBACK_RETRY_SECONDS", (0, 0))
    def boom(*a, **k):
        calls.append(1)
        if len(calls) < 2: raise OSError("net down")
    monkeypatch.setattr(mailer, "send", boom)
    assert client.post("/feedback", json={"text": "hello"}).status_code == 200
    assert len(calls) == 2
    assert "hello" in open(backend.FEEDBACK_FILE, encoding="utf-8").read()


def test_feedback_rate_limited(client):
    codes = [client.post("/feedback", json={"text": f"msg {i}"}).status_code for i in range(7)]
    assert codes[:5] == [200] * 5 and codes[5:] == [429, 429]


def test_gmail_settings_and_overrides():
    import mailer
    assert mailer.settings({}) is None
    g = mailer.settings({"GMAIL_ADDRESS": "me@gmail.com", "GMAIL_APP_PASSWORD": "abcd efgh ijkl mnop"})
    assert (g["host"], g["port"], g["user"], g["password"], g["starttls"]) == ("smtp.gmail.com", 587, "me@gmail.com", "abcdefghijklmnop", True)
    o = mailer.settings({"GMAIL_ADDRESS": "me@gmail.com", "GMAIL_APP_PASSWORD": "x", "MINDSENCE_SMTP_HOST": "smtp.other.test"})
    assert o["host"] == "smtp.other.test"


# ---- /analyze-emotion ----
def test_emotion_requires_file(client, monkeypatch):
    monkeypatch.setattr(backend, "emotion_available", lambda: True)
    assert client.post("/analyze-emotion").status_code == 400


def test_emotion_success(client, monkeypatch):
    monkeypatch.setattr(backend, "emotion_available", lambda: True)
    monkeypatch.setattr(backend, "classify_audio",
                        lambda path: {"emotion": "sad", "confidence": 0.8, "scores": {"sad": 0.8}})
    res = client.post("/analyze-emotion",
                      data={"audio": (io.BytesIO(b"fake"), "voice.webm")},
                      content_type="multipart/form-data")
    assert res.status_code == 200
    assert res.get_json()["emotion"] == "sad"


def test_emotion_short_audio_is_400(client, monkeypatch):
    monkeypatch.setattr(backend, "emotion_available", lambda: True)

    def too_short(path):
        raise ValueError("Audio is too short to analyse")
    monkeypatch.setattr(backend, "classify_audio", too_short)
    res = client.post("/analyze-emotion",
                      data={"audio": (io.BytesIO(b"x"), "voice.webm")},
                      content_type="multipart/form-data")
    assert res.status_code == 400


def test_cors_allows_any_local_port_and_file_origin(client):
    for origin in ("http://localhost:3000", "http://127.0.0.1:5500", "null"):
        res = client.get("/health", headers={"Origin": origin})
        assert res.headers.get("Access-Control-Allow-Origin") == origin, origin


def test_cors_rejects_foreign_origin(client):
    res = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in res.headers


def test_emotion_is_optional_and_says_so(client, monkeypatch):
    monkeypatch.setattr(backend, "emotion_available", lambda: False)
    res = client.post("/analyze-emotion", data={"audio": (io.BytesIO(b"x"), "v.webm")}, content_type="multipart/form-data")
    assert res.status_code == 501
    assert "optional" in res.get_json()["error"].lower()


def test_tts_speed_is_a_clamped_engine_setting_and_part_of_the_cache_key(client, monkeypatch):
    seen = []
    async def fake(text, voice=None, extra_rate=0):
        seen.append(extra_rate)
        return b"audio"
    monkeypatch.setattr(backend, "synthesize", fake)
    backend.audio_cache.items.clear(); backend.audio_cache.size = 0
    for r in (0, 12, 999, -5, "x", True, 12):
        assert client.post("/tts", json={"text": "same words", "rate": r}).status_code == 200
    assert seen == [0, 12, 24]                      # 999 clamps to 24, bad values become 0, repeats come from the cache
    assert backend.rate_string(0) == "+4%" and backend.rate_string(18) == "+22%" and backend.rate_string(99) == "+30%"
