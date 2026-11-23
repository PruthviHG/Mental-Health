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


def test_load_speech_falls_back_to_ffmpeg_for_non_wav_audio(tmp_path):
    """librosa (via libsndfile) can't read webm/opus directly -- this is what the browser actually
    records when its own client-side WAV conversion fails, so the fallback has to really work."""
    pytest.importorskip("librosa")
    import shutil as _shutil
    if not _shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    import subprocess
    webm = tmp_path / "clip.webm"
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=1",
                    "-ar", "16000", "-ac", "1", "-c:a", "libopus", str(webm)],
                   check=True, capture_output=True)
    y, sr = backend._load_speech(str(webm))
    assert sr == 16000 and y.size > 15000


def test_load_speech_unreadable_audio_without_ffmpeg_raises_clear_error(monkeypatch, tmp_path):
    pytest.importorskip("librosa")
    monkeypatch.setattr(backend.shutil, "which", lambda name: None)
    bogus = tmp_path / "clip.bin"
    bogus.write_bytes(b"not audio")
    with pytest.raises(ValueError, match="ffmpeg"):
        backend._load_speech(str(bogus))


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


def test_performance_page_and_its_files_are_served(client):
    for path, kind in (("/performance", "text/html"), ("/performance.css", "text/css"), ("/js/perf/perf_data.js", "javascript"), ("/js/perf/perf.js", "javascript")):
        r = client.get(path)
        assert r.status_code == 200 and kind in r.headers["Content-Type"], path
    assert b"Performance" in client.get("/performance").data


def _results_page(items):
    import json as _j
    renderers = [{"videoRenderer": {"videoId": v, "title": {"runs": [{"text": t}]}, "ownerText": {"runs": [{"text": "Chan"}]},
                                    **({"lengthText": {"simpleText": d}} if d else {})}} for v, t, d in items]
    return "<html><script>var ytInitialData = " + _j.dumps({"contents": {"x": renderers}}) + ";</script></html>"


def test_parse_youtube_results_skips_live_and_long_videos():
    page = _results_page([("aaaaaaaaaaa", "Live now", None), ("bbbbbbbbbbb", "Shape of You", "4:23"), ("ccccccccccc", "10 hour loop", "10:00:00")])
    out = backend.parse_youtube_results(page)
    assert [r["id"] for r in out] == ["bbbbbbbbbbb"] and out[0]["title"] == "Shape of You" and out[0]["channel"] == "Chan"


def test_parse_youtube_results_falls_back_to_plain_ids():
    out = backend.parse_youtube_results('x "videoId":"dQw4w9WgXcQ" y "videoId":"dQw4w9WgXcQ" "videoId":"abcdefghijk"')
    assert [r["id"] for r in out] == ["dQw4w9WgXcQ", "abcdefghijk"]


def test_song_search_without_a_key_reads_the_public_page(client, monkeypatch):
    monkeypatch.setattr(backend, "YT_API_KEY", "")
    monkeypatch.setattr(backend, "_song_cache", {})
    page = _results_page([("bbbbbbbbbbb", "Any Song", "3:10")]).encode()
    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, n=-1): return page
    monkeypatch.setattr(backend.urllib.request, "urlopen", lambda req, timeout=0: Resp())
    j = client.post("/song", json={"q": "Any Song"}).get_json()
    assert j["mode"] == "api" and j["results"][0]["id"] == "bbbbbbbbbbb"


def test_song_search_without_a_key_falls_back_to_a_link_when_offline(client, monkeypatch):
    monkeypatch.setattr(backend, "YT_API_KEY", "")
    monkeypatch.setattr(backend, "_song_cache", {})
    def boom(*a, **k): raise OSError("offline")
    monkeypatch.setattr(backend.urllib.request, "urlopen", boom)
    j = client.post("/song", json={"q": "Shape of You"}).get_json()
    assert j["mode"] == "link" and j["results"] == []
    assert j["url"].startswith("https://www.youtube.com/results?search_query=Shape%20of%20You")


def test_song_search_with_a_key_returns_embeddable_ids(client, monkeypatch):
    monkeypatch.setattr(backend, "YT_API_KEY", "k")
    monkeypatch.setattr(backend, "_song_cache", {})
    seen = {}
    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, n=-1):
            return b'{"items":[{"id":{"videoId":"JGwWNGJdvx8"},"snippet":{"title":"Ed Sheeran - Shape of You","channelTitle":"Ed Sheeran"}},{"id":{"videoId":"bad"},"snippet":{"title":"x"}},{"id":{"videoId":"orjNpUYLlVE"},"snippet":{"title":"Other","channelTitle":"c"}}]}'
    def fake_open(req, timeout=0):
        seen["url"] = req.full_url; return Resp()
    monkeypatch.setattr(backend.urllib.request, "urlopen", fake_open)
    j = client.post("/song", json={"q": "shape of you"}).get_json()
    assert j["mode"] == "api" and [x["id"] for x in j["results"]] == ["JGwWNGJdvx8", "orjNpUYLlVE"]   # the malformed id is dropped
    assert "videoEmbeddable=true" in seen["url"] and "videoCategoryId=10" in seen["url"]
    seen.clear(); client.post("/song", json={"q": "Shape of You"})
    assert not seen                                                  # second request is served from the cache


def test_song_search_failure_and_bad_input(client, monkeypatch):
    monkeypatch.setattr(backend, "YT_API_KEY", "k"); monkeypatch.setattr(backend, "_song_cache", {})
    def boom(req, timeout=0): raise OSError("offline")
    monkeypatch.setattr(backend.urllib.request, "urlopen", boom)
    j = client.post("/song", json={"q": "anything"}).get_json()
    assert j["mode"] == "link" and j["error"] == "search_failed"
    assert client.post("/song", json={"q": " "}).status_code == 400
    assert client.post("/song", json={}).status_code == 400


def test_talk_query_turns_motivation_video_into_spoken_content():
    assert backend.talk_query("a motivation video") == "powerful motivational speech"
    assert backend.talk_query("inspiring") == "most inspiring speech"
    assert backend.talk_query("a ted talk about sleep") == "ted talk about sleep video"


def test_motivation_request_searches_speeches_not_songs(client, monkeypatch):
    monkeypatch.setattr(backend, "YT_API_KEY", "")
    monkeypatch.setattr(backend, "_song_cache", {})
    seen = {}
    page = _results_page([("bbbbbbbbbbb", "Best Motivational Speech", "12:10"), ("ccccccccccc", "Tiny clip", "0:20")]).encode()
    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, n=-1): return page
    def fake_open(req, timeout=0):
        seen["url"] = req.full_url; return Resp()
    monkeypatch.setattr(backend.urllib.request, "urlopen", fake_open)
    j = client.post("/song", json={"q": "a motivation video", "kind": "talk"}).get_json()
    assert "motivational+speech" in seen["url"] and "song" not in seen["url"]
    assert [r["id"] for r in j["results"]] == ["bbbbbbbbbbb"]          # the 20 second clip is dropped


def test_parse_youtube_results_untitled_falls_back_to_video():
    import app as a
    out = a.parse_youtube_results('"videoId":"dQw4w9WgXcQ" "videoId":"abcdefghijk"')
    assert [r["id"] for r in out] == ["dQw4w9WgXcQ", "abcdefghijk"]
    assert all(r["title"] == "Video" for r in out)


def test_song_search_prefers_original_over_lyric_reupload():
    import app as a
    official = {"title": "Animals - Official Music Video", "channel": "Maroon5VEVO"}
    spam = {"title": "Animals - Maroon 5 #lyrics #tiktoksong #fyp #subscribe #maroon5", "channel": "Lyric Venue"}
    assert a._song_originality_score(official["title"], official["channel"]) < a._song_originality_score(spam["title"], spam["channel"])


def test_vibe_colour_filter_reaches_the_particle_canvas():
    css = open("style.css", encoding="utf-8").read()
    m = __import__("re").search(r"html\.themed[^{]*\{\s*filter:\s*hue-rotate", css)
    assert m and "#canvas-container" in m.group(0)
