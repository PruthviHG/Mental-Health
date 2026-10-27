"""Download the few third-party files the page needs (Tailwind, Font Awesome, fonts, Three.js) into assets/vendor/.

Run once:  python tools/get_vendor.py        (run.bat does this for you)
Afterwards the page loads them from your own server: faster first paint, and it works offline.
Safe to re-run; anything that fails is skipped and the page keeps using the internet copy for it.
"""
import hashlib
import os
import re
import sys
import urllib.request

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "vendor")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
TAILWIND = "https://cdn.tailwindcss.com"
FA_BASE = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0"
FA_FONTS = ("fa-solid-900.woff2", "fa-regular-400.woff2", "fa-brands-400.woff2", "fa-v4compatibility.woff2")
GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;700&display=swap"


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def save(rel, data, root=None):
    path = os.path.join(root or ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)                                    # a half-downloaded file never replaces a good one
    return path


def looks_like(data, kind):
    head = data[:400].lstrip().lower()
    if kind == "js":
        return len(data) > 20_000 and not head.startswith((b"<!doctype", b"<html"))
    if kind == "css":
        return len(data) > 200 and not head.startswith((b"<!doctype", b"<html"))
    if kind == "woff2":
        return data[:4] == b"wOF2"
    return bool(data)


def get_three_tailwind(fetch=fetch, root=None):
    done = 0
    for url, rel in ((THREE, "three.min.js"), (TAILWIND, "tailwind.js")):
        try:
            data = fetch(url)
            if not looks_like(data, "js"):
                raise ValueError("unexpected content")
            save(rel, data, root); done += 1
        except Exception as exc:
            print(f"  skipped {rel}: {exc}")
    return done


def get_font_awesome(fetch=fetch, root=None):
    try:
        css = fetch(f"{FA_BASE}/css/all.min.css")
        if not looks_like(css, "css"):
            raise ValueError("unexpected content")
        for name in FA_FONTS:                                # keep the same relative layout: css/ and webfonts/
            font = fetch(f"{FA_BASE}/webfonts/{name}")
            if not looks_like(font, "woff2"):
                raise ValueError(f"bad font {name}")
            save(f"fa/webfonts/{name}", font, root)
        save("fa/css/all.min.css", css, root)                # written last: its presence means the set is complete
        return 1
    except Exception as exc:
        print(f"  skipped Font Awesome: {exc}")
        return 0


def get_google_fonts(fetch=fetch, root=None):
    try:
        css = fetch(GOOGLE_FONTS).decode("utf-8")
        urls = sorted(set(re.findall(r"url\((https://[^)]+?\.woff2)\)", css)))
        if not urls:
            raise ValueError("no font files listed")
        for url in urls:
            font = fetch(url)
            if not looks_like(font, "woff2"):
                raise ValueError("bad font file")
            local = "f_" + hashlib.sha1(url.encode()).hexdigest()[:12] + ".woff2"
            save(f"fonts/{local}", font, root)
            css = css.replace(url, local)
        save("fonts/fonts.css", css.encode("utf-8"), root)
        return 1
    except Exception as exc:
        print(f"  skipped fonts: {exc}")
        return 0


def main():
    print("Downloading page libraries once so Mindsence loads faster and works offline...")
    n = get_three_tailwind() + get_font_awesome() + get_google_fonts()
    print(f"Done: {n}/4 parts saved to assets/vendor. " + ("" if n == 4 else "The rest will keep loading from the internet."))
    return 0 if n == 4 else 1                                # run.bat retries next time unless everything was saved


if __name__ == "__main__":
    sys.exit(main())
