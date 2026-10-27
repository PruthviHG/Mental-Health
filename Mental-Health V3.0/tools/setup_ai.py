"""Set up a free local AI (Ollama) for Mindsence: install it if missing, start it, download a model that fits THIS
computer, and prove it answers. Safe to run again at any time: it only does what is still missing.

    python tools/setup_ai.py                 # automatic
    python tools/setup_ai.py --model qwen2.5:1.5b
    python tools/setup_ai.py --check         # only report, change nothing

Exit code 0 = ready, 1 = not ready (Mindsence then keeps working in simple mode / on-device AI).
"""
import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.request

BASE = (os.environ.get("OLLAMA_HOST") or "http://127.0.0.1:11434").strip().rstrip("/")
if not BASE.startswith("http"):
    BASE = "http://" + BASE
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import llm_providers  # noqa: E402  (same model-ranking rules the server uses)
# (minimum RAM in GB, model, approximate download). Qwen2.5 is a strong small multilingual family.
MODEL_TIERS = ((8.0, "qwen2.5:3b", "1.9 GB"), (4.0, "qwen2.5:1.5b", "1.0 GB"), (0.0, "qwen2.5:0.5b", "0.4 GB"))


def say(msg=""):
    print(msg, flush=True)


# ----- pure helpers (unit-tested) -----
def choose_model(ram_gb):
    """The largest model that comfortably fits in this much memory (unknown memory: the middle one)."""
    if not ram_gb or ram_gb <= 0:
        return MODEL_TIERS[1][1], MODEL_TIERS[1][2]
    for need, model, size in MODEL_TIERS:
        if ram_gb >= need:
            return model, size
    return MODEL_TIERS[-1][1], MODEL_TIERS[-1][2]


def has_model(installed, wanted):
    return any(n == wanted or n.startswith(wanted + "-") or (":" not in wanted and n.split(":")[0] == wanted) for n in installed or [])


def cloud_key_configured(env=None, env_file=None):
    """If a cloud key is already set, local AI is optional: do not download gigabytes unasked."""
    env = os.environ if env is None else env
    if (env.get("ANTHROPIC_API_KEY") or env.get("OPENAI_API_KEY") or "").strip():
        return True
    try:
        with open(env_file or os.path.join(ROOT, ".env"), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(("ANTHROPIC_API_KEY=", "OPENAI_API_KEY=")) and line.split("=", 1)[1].strip().strip("\"'"):
                    return True
    except OSError:
        pass
    return False


# ----- machine facts -----
def total_ram_gb():
    return llm_providers.total_ram_gb()


def find_ollama():
    exe = shutil.which("ollama")
    if exe:
        return exe
    candidates = []
    if os.name == "nt":
        local = os.environ.get("LOCALAPPDATA", "")
        candidates += [os.path.join(local, "Programs", "Ollama", "ollama.exe"), r"C:\Program Files\Ollama\ollama.exe"]
    else:
        candidates += ["/usr/local/bin/ollama", "/usr/bin/ollama", "/opt/homebrew/bin/ollama", "/Applications/Ollama.app/Contents/Resources/ollama"]
    return next((c for c in candidates if os.path.isfile(c)), None)


# ----- talking to Ollama -----
def api(path, payload=None, timeout=8):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"}, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace") or "{}")


def installed_info():
    """[(name, size_bytes)] of the models already downloaded, or None if Ollama is not reachable."""
    try:
        return [(m["name"], m.get("size") or 0) for m in api("/api/tags", timeout=3).get("models", []) if m.get("name")]
    except Exception:
        return None


def installed_models():
    info = installed_info()
    return None if info is None else [n for n, _ in info]


def wait_for_server(seconds):
    end = time.time() + seconds
    while time.time() < end:
        if installed_models() is not None:
            return True
        time.sleep(1)
    return False


def install_ollama():
    if os.name == "nt":
        say("  Installing Ollama (a one-time download of about 1 GB)...")
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
               "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force; irm https://ollama.com/install.ps1 | iex"]
        return subprocess.call(cmd) == 0
    say("  Please install Ollama first, then run this again:")
    say("    macOS / Linux:  https://ollama.com/download")
    return False


def start_server(exe):
    say("  Starting Ollama...")
    flags = 0x00000008 | 0x00000200 if os.name == "nt" else 0           # DETACHED_PROCESS | NEW_PROCESS_GROUP
    try:
        subprocess.Popen([exe, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, creationflags=flags)
    except Exception as exc:
        say(f"  Could not start Ollama: {exc}")


def pull(exe, model):
    for attempt in (1, 2):
        say(f"  Downloading {model} (attempt {attempt}; resumes if interrupted)...")
        if subprocess.call([exe, "pull", model]) == 0:
            return True
        time.sleep(2)
    return False


def prove_it_answers(model):
    t = time.time()
    try:
        out = api("/api/chat", {"model": model, "stream": False, "keep_alive": "1h", "messages": [{"role": "user", "content": "Say hello in one short sentence."}],
                                "options": {"num_predict": 24}}, timeout=180)
        text = ((out.get("message") or {}).get("content") or "").strip()
        return (bool(text), text, time.time() - t)
    except Exception as exc:
        return False, str(exc), time.time() - t


def decide(installed, ram, forced=None):
    """What to do with the models already downloaded: ('use', name) or ('pull', name, size)."""
    if forced:
        return ("use", forced) if has_model([n for n, _ in installed], forced) else ("pull", forced, "?")
    best = llm_providers.pick_ollama_model(installed, ram, strict=True)
    if best:
        return ("use", best)
    model, size = choose_model(ram)
    return ("pull", model, size)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", help="use this model instead of choosing")
    ap.add_argument("--check", action="store_true", help="only report")
    args = ap.parse_args(argv)
    say("Mindsence local AI setup")
    say("------------------------")

    if os.environ.get("MINDSENCE_SKIP_AI") == "1":
        say("  Skipped (MINDSENCE_SKIP_AI=1).")
        return 0
    if not args.model and not args.check and cloud_key_configured():
        say("  A cloud API key is already configured, so a local AI is not needed. (Use --model to install one anyway.)")
        return 0

    ram = total_ram_gb()
    say(f"  This computer: {ram:.1f} GB memory" if ram else "  This computer: memory unknown")
    exe = find_ollama()
    say(f"  Ollama:        {'found at ' + exe if exe else 'not installed'}")

    if args.check:
        info = installed_info()
        say(f"  Running:       {'yes' if info is not None else 'no'}")
        if info:
            say("  Downloaded:    " + ", ".join(n for n, _ in info))
        action = decide(info or [], ram, args.model)
        say(f"  Would use:     {action[1]}" if action[0] == "use" else f"  Would download: {action[1]} ({action[2]})")
        return 0 if info is not None and action[0] == "use" else 1

    if not exe:
        if not install_ollama():
            say("  Ollama could not be installed. Mindsence will still run (simple mode / on-device AI).")
            return 1
        exe = find_ollama()
        if not exe:
            say("  Ollama installed, but not found yet. Close this window, open run.bat again.")
            return 1
    info = installed_info()
    if info is None:
        start_server(exe)
        if not wait_for_server(40):
            say("  Ollama did not start. Open the Ollama app from the Start menu once, then run again.")
            return 1
        info = installed_info() or []

    say("  Downloaded:    " + (", ".join(n for n, _ in info) if info else "no models yet"))
    action = decide(info, ram, args.model)
    if action[0] == "use":
        model = action[1]
        say(f"  Using:         {model} (already downloaded, best that fits this computer; nothing to download)")
    else:
        model, size = action[1], action[2]
        say(f"  Downloading:   {model} ({size}), the best fit for this computer")
        if not pull(exe, model):
            say("  The model download did not finish. Check the internet connection and run again (it resumes).")
            return 1
    ok, text, secs = prove_it_answers(model)
    if not ok:
        say(f"  The model is installed but did not answer: {text}")
        return 1
    say(f"  Test reply ({secs:.0f}s, includes loading the model): {text[:80]}")
    say("  READY: Mindsence will use it automatically (header shows ONLINE with the model name).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
