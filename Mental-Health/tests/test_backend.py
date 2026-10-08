import io
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "FEEDBACK_FILE", str(tmp_path / "feedback.jsonl"))
    backend.app.config["TESTING"] = True
    return backend.app.test_client()


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
    async def fake(text):
        return b"ID3-fake-mp3"
    monkeypatch.setattr(backend, "synthesize", fake)
    res = client.post("/tts", json={"text": "hello"})
    assert res.status_code == 200
    assert res.mimetype == "audio/mpeg"
    assert res.data == b"ID3-fake-mp3"


def test_tts_failure_is_502(client, monkeypatch):
    async def boom(text):
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


# ---- /analyze-emotion ----
def test_emotion_requires_file(client):
    assert client.post("/analyze-emotion").status_code == 400


def test_emotion_success(client, monkeypatch):
    monkeypatch.setattr(backend, "classify_audio",
                        lambda path: {"emotion": "sad", "confidence": 0.8, "scores": {"sad": 0.8}})
    res = client.post("/analyze-emotion",
                      data={"audio": (io.BytesIO(b"fake"), "voice.webm")},
                      content_type="multipart/form-data")
    assert res.status_code == 200
    assert res.get_json()["emotion"] == "sad"


def test_emotion_short_audio_is_400(client, monkeypatch):
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
