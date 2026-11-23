"""Browser timings for the Performance page: page load, time to the crisis screen, time to a reply (no-AI fallback).
Run from the project folder:  python tools/benchmark_browser.py   (needs: pip install playwright && playwright install chromium)
Writes tools/browser_results.json; then run  node tools/benchmark.js  to merge it into js/perf/perf_data.js."""
import json, os, re, statistics as st, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = 5871
env = dict(os.environ, MINDSENCE_DB=os.path.join(os.environ.get("TMPDIR", "/tmp"), f"bench_{os.getpid()}.db"), PORT=str(port), MINDSENCE_HOST="127.0.0.1",
           MINDSENCE_LAZY_MODEL="1", MINDSENCE_LLM_PROVIDER="none", MINDSENCE_FEEDBACK_FILE=os.path.join(os.environ.get("TMPDIR", "/tmp"), f"bench_fb_{os.getpid()}.jsonl"),
           NO_PROXY="127.0.0.1,localhost", no_proxy="127.0.0.1,localhost")
for k in ("GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "MINDSENCE_SMTP_HOST"): env.pop(k, None)
p = subprocess.Popen([sys.executable, "app.py"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(80):
    try: urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=.5); break
    except Exception: time.sleep(.25)
def med(a): return round(st.median(a), 1)
def p95(a): a = sorted(a); return round(a[min(len(a) - 1, int(len(a) * .95))], 1)
out = {}
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 1100, "height": 760}, locale="en-US")
        page = ctx.new_page()
        # health endpoint round trip
        h = []
        for _ in range(30):
            t = time.perf_counter(); urllib.request.urlopen(f"http://127.0.0.1:{port}/health").read(); h.append((time.perf_counter() - t) * 1000)
        page.goto(f"http://127.0.0.1:{port}/")
        page.evaluate("async () => { await fetch('/auth/signup', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'bench'+Date.now()+'@example.com', password:'a good long pass 77'})}); }")
        cdp = ctx.new_cdp_session(page)
        def ready_ms():
            page.wait_for_selector("#chatbox .ai-text", timeout=8000)
            return page.evaluate("performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd")
        loads, warm = [], []
        for _ in range(8):   # COLD: browser cache emptied first = a first visit. ms until the page is ready (DOM parsed, every script run)
            cdp.send("Network.clearBrowserCache"); page.reload(wait_until="domcontentloaded"); loads.append(ready_ms())
        page.reload(wait_until="domcontentloaded")
        for _ in range(8):   # WARM: a repeat visit (scripts and styles come from the browser's cache)
            page.reload(wait_until="domcontentloaded"); warm.append(ready_ms())
        def timed(msg, wait_js, reps=10):
            res = []
            for _ in range(reps):
                page.reload(wait_until="domcontentloaded"); page.wait_for_selector("#chatbox .ai-text", timeout=8000)
                page.wait_for_timeout(300)
                page.fill("#messageInput", msg)
                n = page.locator("#chatbox .ai-text").count()
                t0 = page.evaluate("performance.now()")
                page.click("#sendButton")
                page.wait_for_function(wait_js.replace("N", str(n)), timeout=15000, polling="raf")
                res.append(page.evaluate("performance.now()") - t0)
            return res
        crisis = timed("I want to end my life", "document.querySelector('.crisis-bubble, .crisis-msg, [data-crisis]') !== null || document.querySelectorAll('#chatbox .ai-text').length > N")
        reply = timed("I feel a bit tired today", "document.querySelectorAll('#chatbox .ai-text').length > N && !document.querySelector('.typing-dots')")
        out["browser"] = {"healthMs": med(h), "loadMs": med(loads), "loadP95": p95(loads), "warmLoadMs": med(warm), "warmLoadP95": p95(warm), "crisisMs": med(crisis), "crisisP95": p95(crisis), "replyMs": med(reply), "replyP95": p95(reply),
                          "runs": {"load": len(loads), "warm": len(warm), "crisis": len(crisis), "reply": len(reply)}, "note": "localhost, headless Chromium, no AI model (built-in fallback replies)"}
        b.close()
finally:
    p.terminate()
json.dump(out, open(os.path.join(ROOT, "tools", "browser_results.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
