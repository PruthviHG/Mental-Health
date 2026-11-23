"""End-to-end smoke test in a real browser (Chromium via Playwright). Not part of the pytest run (needs a browser).
Run from the project folder:   python tests/e2e_smoke.py        (pip install playwright && playwright install chromium)
It starts its own server on a spare port with no AI model, signs up a throw-away account and checks the things that
matter: nothing is loaded from other servers, no script errors, replies are never repeated, crisis wording shows the
helplines, the help card fits a short screen, languages switch, games/rooms/performance open, phones do not scroll sideways,
and a repeat visit comes from the browser cache."""
import json, os, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5893
BASE = f"http://127.0.0.1:{PORT}"
tmp = tempfile.mkdtemp()
env = dict(os.environ, MINDSENCE_DB=os.path.join(tmp, "e2e.db"), PORT=str(PORT), MINDSENCE_HOST="127.0.0.1", MINDSENCE_LAZY_MODEL="1",
           MINDSENCE_LLM_PROVIDER="none", MINDSENCE_FEEDBACK_FILE=os.path.join(tmp, "fb.jsonl"), NO_PROXY="127.0.0.1,localhost", no_proxy="127.0.0.1,localhost")
for k in ("GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "MINDSENCE_SMTP_HOST"):
    env.pop(k, None)
server = subprocess.Popen([sys.executable, "app.py"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fails, total = [], 0


def check(name, ok, detail=""):
    global total
    total += 1
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "  -> " + str(detail)))
    if not ok:
        fails.append(name)


def signed_in(browser, viewport):
    ctx = browser.new_context(viewport=viewport, locale="en-US")
    r = ctx.request.post(BASE + "/auth/signup", data={"email": f"e2e{time.time_ns()}@example.com", "password": "correct horse 42"})
    assert r.status == 201, r.status
    page = ctx.new_page()
    page.errors, page.hosts = [], set()
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("request", lambda rq: page.hosts.add(rq.url.split("/")[2]) if rq.url.startswith("http") else None)
    return ctx, page


try:
    for _ in range(80):
        try:
            urllib.request.urlopen(BASE + "/health", timeout=.5); break
        except Exception:
            time.sleep(.25)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"])

        # ---------- desktop ----------
        ctx, page = signed_in(b, {"width": 1280, "height": 800})
        page.goto(BASE + "/", wait_until="load"); page.wait_for_selector("#chatbox .ai-text", timeout=8000); page.wait_for_timeout(800)
                # Page libraries (CSS, fonts, icons, scripts) all come from our server. What may still be fetched at start-up is the music list
        # and music file (GitHub) and the optional on-device AI module (jsDelivr), both features of their own.
        check("no page library comes from another server", page.hosts <= {f"127.0.0.1:{PORT}", "api.github.com", "raw.githubusercontent.com", "cdn.jsdelivr.net", "cdn.pixabay.com"}, page.hosts)
        check("rooms/games pictures are not fetched at start-up", not any("unsplash" in h for h in page.hosts), page.hosts)
        check("no script errors on load", not page.errors, page.errors)
        check("stylesheet built (Tailwind classes work)", page.evaluate("getComputedStyle(document.querySelector('#chatbox')).display") in ("flex", "grid", "block"))
        check("icons draw (mic mask has a size)", page.evaluate("(() => { const i = document.querySelector('#liveVoiceBtn .fas'); const r = i.getBoundingClientRect(); return r.width > 8 && getComputedStyle(i).maskImage !== 'none' || getComputedStyle(i).webkitMaskImage !== 'none'; })()"))
        check("'Need help?' is visible", page.is_visible("button:has-text('Need help')"))
        check("background canvas is drawn (original three.js particles)", page.evaluate("(() => { const c = document.querySelector('#canvas-container canvas'); return !!c && c.width > 100; })()"))

        # replies are never the same twice in a row
        replies = []
        for text in ("ok", "hmm", "whatever", "i dont know", "nothing"):
            n = page.locator("#chatbox .ai-text").count()
            page.fill("#messageInput", text); page.click("#sendButton")
            page.wait_for_function("n => document.querySelectorAll('#chatbox .ai-text').length > n && !document.querySelector('.typing-dots')", arg=n, timeout=15000)
            last, same = "", 0
            while same < 4:                                   # the reply types itself out: wait until it stops changing
                page.wait_for_timeout(150)
                now = page.locator("#chatbox .ai-text").last.inner_text().strip()
                same = same + 1 if now == last else 0
                last = now
            replies.append(last)
        check("5 short messages -> 5 different replies", len(set(replies)) == 5, replies)

        # crisis wording
        n = page.locator("#chatbox .ai-text").count()
        page.fill("#messageInput", "i just want to disappear"); page.click("#sendButton")
        page.wait_for_function("n => document.querySelectorAll('#chatbox .ai-text').length > n && !document.querySelector('.typing-dots')", arg=n, timeout=15000)
        page.wait_for_timeout(500)
        body = page.inner_text("#chatbox")
        check("crisis wording shows helplines", "14416" in body or "988" in body or "112" in body or "helpline" in body.lower(), body[-300:])

        # help card on a short screen
        page.set_viewport_size({"width": 1280, "height": 480})
        page.click("button:has-text('Need help')"); page.wait_for_timeout(400)
        box = page.locator(".help-card").bounding_box()
        check("help card fits a short screen (scrolls inside)", box["y"] >= 0 and box["y"] + box["height"] <= 480 + 1, box)
        page.keyboard.press("Escape"); page.set_viewport_size({"width": 1280, "height": 800})

        # language switch
        page.select_option("#lang-select", "kn"); page.wait_for_timeout(500)
        check("Kannada switches the interface", page.inner_text("button[onclick='openArcade()']").strip() not in ("Games", ""), page.inner_text("button[onclick='openArcade()']"))
        page.select_option("#lang-select", "en"); page.wait_for_timeout(300)

        # games and rooms
        page.evaluate("openArcade()"); page.wait_for_timeout(400)
        check("games menu opens", page.is_visible("#game-modal") and page.locator("#arcade-menu .arcade-btn").count() >= 8)
        page.evaluate("closeArcade ? closeArcade() : null") if page.evaluate("typeof closeArcade") == "function" else page.reload()
        page.wait_for_timeout(300)

        # performance page + back in the same tab
        page.goto(BASE + "/", wait_until="load"); page.wait_for_selector("#chatbox .ai-text")
        page.click("a[href='/performance']"); page.wait_for_selector("text=Performance", timeout=5000)
        check("performance page opens in the same tab", len(ctx.pages) == 1 and page.url.endswith("/performance"), page.url)
        check("performance page: no script errors", not [e for e in page.errors], page.errors)

        # repeat visit comes from the browser cache
        page.goto(BASE + "/", wait_until="load"); page.wait_for_selector("#chatbox .ai-text")
        page.goto(BASE + "/", wait_until="load"); page.wait_for_selector("#chatbox .ai-text")
        cached = page.evaluate("performance.getEntriesByType('resource').filter(r => /\\.(js|css)\\?v=/.test(r.name) && r.transferSize === 0).length")
        total_files = page.evaluate("performance.getEntriesByType('resource').filter(r => /\\.(js|css)\\?v=/.test(r.name)).length")
        check("repeat visit: scripts/styles come from cache", total_files > 20 and cached >= total_files - 2, (cached, total_files))
        ctx.close()

        # ---------- phone ----------
        ctx, page = signed_in(b, {"width": 390, "height": 780})
        page.goto(BASE + "/", wait_until="load"); page.wait_for_selector("#chatbox .ai-text"); page.wait_for_timeout(600)
        check("phone: no sideways scroll", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), page.evaluate("[document.documentElement.scrollWidth, innerWidth]"))
        bb = page.locator("button:has-text('Need help')").first.bounding_box()
        check("phone: 'Need help?' is on screen", bb and 0 <= bb["x"] and bb["x"] + bb["width"] <= 391 and 0 <= bb["y"] <= 200, bb)
        check("phone: no script errors", not page.errors, page.errors)
        ctx.close(); b.close()
finally:
    server.terminate()

print(f"\n{total - len(fails)}/{total} checks passed")
sys.exit(1 if fails else 0)
