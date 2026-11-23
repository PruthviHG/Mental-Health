"""Fish Audio voice: the key stays on the server, languages route to the right engine, and any failure falls back to the Microsoft voice."""
import io
import json
import os
import sys
import urllib.error

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
import fish_voice  # noqa: E402
from test_backend import client  # noqa: E402,F401

KEY = "sk-fish-TEST-ONLY-0000"
MP3 = b"ID3" + b"x" * 400


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def fish(monkeypatch):
    """Fish Audio turned on, the network replaced by a recorder, the Microsoft voice replaced by a marker."""
    calls = []

    def fake_urlopen(req, timeout=0):
        calls.append({"url": req.full_url, "headers": {k.lower(): v for k, v in req.header_items()}, "body": json.loads(req.data)})
        return FakeResponse(MP3)

    async def fake_edge(text, voice=None, extra_rate=0):
        calls.append({"edge": voice})
        return b"EDGE-AUDIO" * 50

    monkeypatch.setenv("FISH_API_KEY", KEY)
    for k in ("MINDSENCE_FISH_LANGS", "MINDSENCE_FISH_VOICE", "MINDSENCE_FISH_VOICE_EN", "MINDSENCE_FISH_VOICE_JA"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setattr(fish_voice.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(backend, "synthesize", fake_edge)
    monkeypatch.setattr(fish_voice, "_pause_until", [0.0])
    backend.audio_cache.items.clear(); backend.audio_cache.size = 0
    return calls


def say(client, text, lang):
    return client.post("/tts", json={"text": text, "lang": lang})


def test_english_uses_fish_with_the_soft_voice_and_the_key_only_in_the_header(client, fish):
    r = say(client, "Hello, I am here with you.", "en")
    assert r.status_code == 200 and r.data == MP3 and r.mimetype == "audio/mpeg"
    c = fish[0]
    assert c["url"] == "https://api.fish.audio/v1/tts"
    assert c["headers"]["authorization"] == "Bearer " + KEY and c["headers"]["model"] == fish_voice.FISH_MODEL
    assert c["body"]["reference_id"] == fish_voice.VOICE_SARAH and c["body"]["format"] == "mp3"
    assert KEY not in json.dumps(c["body"])


def test_japanese_gets_the_calm_japanese_voice(client, fish):
    say(client, "ここにいますよ。", "ja")
    assert fish[0]["body"]["reference_id"] == fish_voice.VOICE_CALM_JA


def test_indian_languages_stay_on_the_microsoft_voices_unless_enabled(client, fish, monkeypatch):
    say(client, "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ.", "kn")
    assert fish == [{"edge": "kn-IN-SapnaNeural"}]
    monkeypatch.setenv("MINDSENCE_FISH_LANGS", "all")
    say(client, "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ, ನಿಮ್ಮ ಜೊತೆ.", "kn")
    assert fish[-1]["body"]["reference_id"] == fish_voice.VOICE_SARAH


def test_no_key_means_microsoft_only(client, fish, monkeypatch):
    monkeypatch.delenv("FISH_API_KEY")
    r = say(client, "Hello there friend", "en")
    assert r.status_code == 200 and fish == [{"edge": "en-GB-SoniaNeural"}]


def test_a_rejected_key_falls_back_at_once_and_pauses_fish(client, fish, monkeypatch):
    def deny(req, timeout=0):
        fish.append("fish-called")
        raise urllib.error.HTTPError(req.full_url, 402, "Payment Required", {}, None)
    monkeypatch.setattr(fish_voice.urllib.request, "urlopen", deny)
    r = say(client, "First sentence here", "en")
    assert r.status_code == 200 and r.data.startswith(b"EDGE-AUDIO")
    say(client, "Second sentence here", "en")
    assert fish.count("fish-called") == 1                    # paused: the second sentence did not even try Fish
    assert not fish_voice.wanted("en")


def test_a_network_error_falls_back_and_never_leaks_the_key(client, fish, monkeypatch, caplog):
    def down(req, timeout=0):
        raise OSError("connection refused " + req.full_url)
    monkeypatch.setattr(fish_voice.urllib.request, "urlopen", down)
    with caplog.at_level("DEBUG"):
        r = say(client, "Are you there", "en")
    assert r.status_code == 200 and r.data.startswith(b"EDGE-AUDIO")
    assert KEY not in r.get_data(as_text=True) and KEY not in caplog.text


def test_health_and_pages_never_show_the_key(client, fish):
    assert KEY not in client.get("/health").get_data(as_text=True)
    assert client.get("/health").get_json()["tts_engine"] == "fish-audio + fallback"
    for path in ("/", "/performance"):
        assert KEY not in client.get(path).get_data(as_text=True)


def test_fish_and_fallback_audio_are_cached_separately(client, fish):
    say(client, "Same words twice", "en"); say(client, "Same words twice", "en")
    assert sum(1 for c in fish if isinstance(c, dict) and "url" in c) == 1          # second one came from the cache


def test_speed_follows_the_app_request_and_is_clamped(fish):
    fish_voice.synthesize("hello hello hello", "en", 12)
    assert fish[0]["body"]["prosody"]["speed"] == 1.16
    fish_voice.synthesize("hello hello hello", "en", 999)
    assert fish[1]["body"]["prosody"]["speed"] == 2.0


def test_per_language_voice_override(fish, monkeypatch):
    monkeypatch.setenv("MINDSENCE_FISH_VOICE_EN", "abc123")
    assert fish_voice.voice_for("en-GB") == "abc123" and fish_voice.voice_for("ja") == fish_voice.VOICE_CALM_JA


def test_the_key_is_not_in_any_project_file():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "__pycache__", ".pytest_cache")]
        for f in files:
            if f.endswith((".py", ".js", ".html", ".md", ".css", ".example", ".json", ".bat")):
                assert "sk-fish-" not in open(os.path.join(dirpath, f), encoding="utf-8", errors="ignore").read().replace("sk-fish-TEST-ONLY", "") \
                    or f == "test_fish.py", f
