"""Speed features: spoken-audio cache, local copies of third-party files, long caching of them."""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
from authhelper import signed_in_client  # noqa: E402


@pytest.fixture
def client(monkeypatch, tmp_path):
    return signed_in_client(monkeypatch, tmp_path)


def test_repeated_speech_is_served_from_the_cache(client, monkeypatch):
    calls = []
    async def fake(text, voice=None, extra_rate=0):
        calls.append((text, voice)); return b"ID3-" + text.encode()
    monkeypatch.setattr(backend, "synthesize", fake)
    monkeypatch.setattr(backend, "audio_cache", backend.AudioCache())
    first = client.post("/tts", json={"text": "I'm here with you.", "lang": "en"})
    second = client.post("/tts", json={"text": "I'm here with you.", "lang": "en"})
    other_voice = client.post("/tts", json={"text": "I'm here with you.", "lang": "hi"})
    assert first.data == second.data == other_voice.data
    assert len(calls) == 2                                           # the second English request never reached the voice service


def test_failed_speech_is_not_cached(client, monkeypatch):
    state = {"n": 0}
    async def flaky(text, voice=None, extra_rate=0):
        state["n"] += 1
        if state["n"] == 1:
            raise RuntimeError("offline")
        return b"ID3-ok"
    monkeypatch.setattr(backend, "synthesize", flaky)
    monkeypatch.setattr(backend, "audio_cache", backend.AudioCache())
    assert client.post("/tts", json={"text": "hello there"}).status_code == 502
    assert client.post("/tts", json={"text": "hello there"}).status_code == 200


def test_audio_cache_is_bounded_and_least_recently_used():
    c = backend.AudioCache(max_items=3, max_bytes=1000)
    for k in "abc":
        c.put(k, b"x" * 10)
    c.get("a")                                                       # a is now the freshest
    c.put("d", b"x" * 10)
    assert c.get("b") is None and c.get("a") and c.get("c") and c.get("d")
    c.put("big", b"x" * 900)                                         # bigger than a quarter of the budget: refused
    assert c.get("big") is None
    small = backend.AudioCache(max_items=100, max_bytes=100)
    for i in range(20):
        small.put(i, b"x" * 20)
    assert small.size <= 100


def test_page_loads_everything_from_its_own_server(client):
    page = client.get("/").get_data(as_text=True)
    for third_party in ("cdn.tailwindcss.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"):
        assert third_party not in page, third_party
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for rel in ("assets/css/tailwind.css", "assets/css/icons.css", "assets/vendor/fonts/fonts.css"):
        assert rel in page and os.path.isfile(os.path.join(root, rel)), rel


def test_scripts_are_deferred_and_versioned(client):
    page = client.get("/").get_data(as_text=True)
    scripts = re.findall(r'<script src="([^"]+)"([^>]*)>', page)
    assert len(scripts) >= 20 and all("defer" in rest for _, rest in scripts), "a blocking script is back"
    local = [src for src, _ in scripts if src.startswith("js/")]
    assert local and all(re.search(r"\.js\?v=[0-9a-f]{10}$", src) for src in local)
    assert re.search(r'href="style\.css\?v=[0-9a-f]{10}"', page) and re.search(r'href="assets/css/tailwind\.css\?v=[0-9a-f]{10}"', page)


def test_versioned_files_are_kept_for_a_year_and_plain_ones_are_revalidated(client):
    page = client.get("/").get_data(as_text=True)
    src = re.search(r'src="(js/chat/chat\.js\?v=[0-9a-f]+)"', page).group(1)
    r = client.get("/" + src)
    assert r.status_code == 200 and "immutable" in r.headers["Cache-Control"]
    plain = client.get("/js/chat/chat.js")
    assert plain.headers["Cache-Control"] == "no-cache"
    assert client.get("/js/chat/chat.js", headers={"If-None-Match": plain.headers["ETag"]}).status_code == 304
    assert client.get("/").headers["Cache-Control"] == "no-cache"


def test_version_changes_when_a_file_changes(monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    f = tmp_path / "style.css"; f.write_text("a{}")
    v1 = backend.asset_version("style.css"); f.write_text("b{color:red}")
    os.utime(f, ns=(10**18, 10**18 + 5))
    assert backend.asset_version("style.css") != v1 and backend.asset_version("nope.css") is None


def test_vendor_files_are_cached_for_a_year_but_the_page_is_not(client, monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    (tmp_path / "assets" / "vendor").mkdir(parents=True)
    (tmp_path / "assets" / "vendor" / "x.js").write_text("//" + "x" * 3000)
    (tmp_path / "assets" / "logo.txt").write_text("hi")
    (tmp_path / "index.html").write_text("<html></html>")
    r = client.get("/assets/vendor/x.js", headers={"Accept-Encoding": "gzip"})
    assert "immutable" in r.headers["Cache-Control"] and r.headers["Content-Encoding"] == "gzip"
    assert "immutable" not in client.get("/assets/logo.txt").headers.get("Cache-Control", "")
    assert client.get("/").headers["Cache-Control"] == "no-cache"
    assert client.get("/assets/../app.py").status_code == 404


def test_static_files_are_compressed_and_revalidated(client):
    import gzip
    plain = client.get("/js/i18n/locales.js", headers={"Accept-Encoding": "identity"})
    packed = client.get("/js/i18n/locales.js", headers={"Accept-Encoding": "gzip, br"})
    assert plain.status_code == packed.status_code == 200
    assert "Content-Encoding" not in plain.headers
    assert packed.headers["Content-Encoding"] == ("br" if backend.brotli else "gzip")
    only_gzip = client.get("/js/i18n/locales.js", headers={"Accept-Encoding": "gzip"})
    assert only_gzip.headers["Content-Encoding"] == "gzip" and gzip.decompress(only_gzip.data) == plain.data
    if backend.brotli:
        assert backend.brotli.decompress(packed.data) == plain.data
    assert len(packed.data) < len(plain.data) / 2
    assert packed.mimetype == "text/javascript"
    etag = packed.headers["ETag"]
    again = client.get("/js/i18n/locales.js", headers={"Accept-Encoding": "gzip", "If-None-Match": etag})
    assert again.status_code == 304 and not again.data
    assert client.get("/style.css").mimetype == "text/css"
    assert client.get("/").mimetype == "text/html"


def test_static_paths_cannot_escape(client):
    for path in ("/js/../app.py", "/js/..%2Fapp.py", "/js/%2e%2e/auth.py", "/js/nope.js", "/js/auth.py", "/js/", "/.env", "/app.py"):
        assert client.get(path).status_code in (404, 308, 405), path


def test_music_folder_is_listed(client, monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    assert client.get("/music").get_json() == {"tracks": []}
    folder = tmp_path / "assets" / "music"; folder.mkdir(parents=True)
    (folder / "Rain_on-roof.mp3").write_bytes(b"x"); (folder / "notes.txt").write_text("no"); (folder / "a b.ogg").write_bytes(b"x")
    (folder / "sub").mkdir()
    tracks = client.get("/music").get_json()["tracks"]
    assert [t["name"] for t in tracks] == ["a b", "Rain on roof"]
    assert tracks[0]["url"] == "/assets/music/a%20b.ogg"
    assert client.get(tracks[0]["url"]).status_code == 200
