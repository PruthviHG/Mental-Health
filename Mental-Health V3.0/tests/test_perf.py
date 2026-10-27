"""Speed features: spoken-audio cache, local copies of third-party files, long caching of them."""
import os
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


def test_page_uses_cdn_until_local_copies_exist_then_switches(client, monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    open(tmp_path / "index.html", "w", encoding="utf-8").write(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html"), encoding="utf-8").read())
    page = client.get("/").get_data(as_text=True)
    assert "https://cdn.tailwindcss.com" in page and "cdnjs.cloudflare.com/ajax/libs/three.js" in page and "assets/vendor/" not in page
    vendor = tmp_path / "assets" / "vendor"
    (vendor / "fa" / "css").mkdir(parents=True); (vendor / "fonts").mkdir()
    (vendor / "tailwind.js").write_text("//"); (vendor / "three.min.js").write_text("//")
    (vendor / "fa" / "css" / "all.min.css").write_text("/**/"); (vendor / "fonts" / "fonts.css").write_text("/**/")
    page = client.get("/").get_data(as_text=True)
    assert "cdn.tailwindcss.com" not in page and "assets/vendor/tailwind.js" in page
    assert "assets/vendor/fa/css/all.min.css" in page and "assets/vendor/fonts/fonts.css" in page
    assert 'src="assets/vendor/three.min.js"' in page and "ajax/libs/three.js" not in page
    assert "fonts.googleapis.com" not in page and "font-awesome" not in page


def test_page_partially_vendored_only_swaps_what_exists(client, monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    open(tmp_path / "index.html", "w", encoding="utf-8").write(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html"), encoding="utf-8").read())
    (tmp_path / "assets" / "vendor").mkdir(parents=True)
    (tmp_path / "assets" / "vendor" / "tailwind.js").write_text("//")
    page = client.get("/").get_data(as_text=True)
    assert "assets/vendor/tailwind.js" in page and "font-awesome" in page          # fonts were not downloaded: still the CDN


def test_vendor_files_are_cached_for_a_year_but_the_page_is_not(client, monkeypatch, tmp_path):
    monkeypatch.setattr(backend, "ROOT", str(tmp_path))
    (tmp_path / "assets" / "vendor").mkdir(parents=True)
    (tmp_path / "assets" / "vendor" / "x.js").write_text("//")
    (tmp_path / "assets" / "logo.txt").write_text("hi")
    (tmp_path / "index.html").write_text("<html></html>")
    assert "immutable" in client.get("/assets/vendor/x.js").headers["Cache-Control"]
    assert "immutable" not in client.get("/assets/logo.txt").headers.get("Cache-Control", "")
    assert client.get("/").headers["Cache-Control"] == "no-cache"
    assert client.get("/assets/../app.py").status_code == 404


def test_vendor_downloader_saves_complete_sets_only(tmp_path):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
    import get_vendor
    root = str(tmp_path)
    woff = b"wOF2" + b"\0" * 50
    def good(url, timeout=30):
        if url.endswith(".woff2"): return woff
        if "fonts.googleapis.com" in url:
            return b"@font-face{src:url(https://fonts.gstatic.com/s/inter/a.woff2) format('woff2')}@font-face{src:url(https://fonts.gstatic.com/s/mono/b.woff2)}" + b" " * 300
        if url.endswith(".css"): return b"@font-face{src:url(../webfonts/fa-solid-900.woff2)}" + b" " * 300
        return b"/*js*/" + b"x" * 30000
    assert get_vendor.get_three_tailwind(good, root) == 2
    assert get_vendor.get_font_awesome(good, root) == 1
    assert get_vendor.get_google_fonts(good, root) == 1
    css = open(os.path.join(root, "fonts", "fonts.css")).read()
    assert "https://" not in css and ".woff2" in css
    for f in os.listdir(os.path.join(root, "fonts")):
        assert not f.endswith(".part")

    bad_root = str(tmp_path / "bad")
    def html_error(url, timeout=30):
        return b"<!DOCTYPE html><html>blocked</html>" + b" " * 30000
    assert get_vendor.get_three_tailwind(html_error, bad_root) == 0              # an error page is never saved as a script
    def fa_half(url, timeout=30):
        if url.endswith("fa-regular-400.woff2"): raise OSError("dropped")
        return good(url)
    assert get_vendor.get_font_awesome(fa_half, bad_root) == 0
    assert not os.path.exists(os.path.join(bad_root, "fa", "css", "all.min.css"))   # css is written last: half sets are not used


def test_static_files_are_compressed_and_revalidated(client):
    import gzip
    plain = client.get("/js/locales.js", headers={"Accept-Encoding": "identity"})
    packed = client.get("/js/locales.js", headers={"Accept-Encoding": "gzip, br"})
    assert plain.status_code == packed.status_code == 200
    assert packed.headers["Content-Encoding"] == "gzip" and "Content-Encoding" not in plain.headers
    assert gzip.decompress(packed.data) == plain.data and len(packed.data) < len(plain.data) / 2
    assert packed.mimetype == "text/javascript"
    etag = packed.headers["ETag"]
    again = client.get("/js/locales.js", headers={"Accept-Encoding": "gzip", "If-None-Match": etag})
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
