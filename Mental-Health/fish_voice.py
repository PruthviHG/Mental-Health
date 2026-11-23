"""Fish Audio text-to-speech, used as the first choice for the languages it speaks best.

- The API key lives only in the server's environment (FISH_API_KEY, e.g. in .env). It is never sent to the browser, never
  logged, and never shown by /health.
- Every call can fall back: if Fish Audio is off, slow, out of credit or does not cover a language, app.py uses the
  Microsoft neural voice for that language, and the browser's own voice after that. Speech never stops working.
- After an error that will not fix itself in seconds (bad key, no credit, rate limit) Fish Audio is skipped for a few
  minutes, so one bad key does not add a delay to every sentence.
"""
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request

log = logging.getLogger("mindsence.fish")

FISH_URL = os.getenv("MINDSENCE_FISH_URL", "https://api.fish.audio/v1/tts")
# s2.1-pro-free is the free developer model (free until 2026-11-30 per Fish Audio, no uptime promise). If you have credit,
# set MINDSENCE_FISH_MODEL=s3-pro (or s2.1-pro) for the paid models.
FISH_MODEL = os.getenv("MINDSENCE_FISH_MODEL", "s2.1-pro-free")
FISH_TIMEOUT = float(os.getenv("MINDSENCE_FISH_TIMEOUT", "12"))
FISH_LATENCY = os.getenv("MINDSENCE_FISH_LATENCY", "low")          # low | normal | balanced

# Voices from the Fish Audio library (fish.audio/m/<id>), chosen for a calm companion:
#   Sarah  - young, soft, breathy, gentle, sincere (English)             -> the default voice
#   Calm Woman (落ち着いた女性) - calm, soft, warm, gentle (Japanese)      -> Japanese
# Not used on purpose: "Hannah" (an advertising voice) and "Ada Wong" (a video-game character's voice).
VOICE_SARAH = "933563129e564b19a115bedd57b7406a"
VOICE_CALM_JA = "0089dce5fefb4c6ba9b9f2f0debe1ddc"
DEFAULT_VOICES = {"en": VOICE_SARAH, "ja": VOICE_CALM_JA}

# Languages Fish Audio is asked to speak. Its documented core set; the six Indian languages stay on the Microsoft
# voices (made for them) until you have listened to Fish Audio in them. Change with MINDSENCE_FISH_LANGS="en,ja,hi,..." or "all".
ALL_LANGS = ("en", "hi", "kn", "ta", "te", "bn", "mr", "es", "fr", "de", "pt", "ar", "zh", "ja")
DEFAULT_LANGS = ("en", "ja", "zh", "es", "fr", "de", "pt", "ar")


SPEED_LIMIT = float(os.getenv("MINDSENCE_FISH_MAX_SECONDS", "1.6"))   # a sentence slower than this twice in a row turns Fish off for a while


def api_key():
    return os.getenv("FISH_API_KEY", "").strip()


def enabled_langs():
    raw = os.getenv("MINDSENCE_FISH_LANGS", "").strip().lower()
    if not raw:
        return set(DEFAULT_LANGS)
    if raw == "all":
        return set(ALL_LANGS)
    return {c.strip() for c in raw.split(",") if c.strip()}


def voice_for(lang):
    """Voice id for a language: MINDSENCE_FISH_VOICE_<LANG> if set, else the library voice for it, else Sarah."""
    code = (lang or "en").split("-")[0].lower()
    return os.getenv("MINDSENCE_FISH_VOICE_" + code.upper(), "").strip() or DEFAULT_VOICES.get(code) or os.getenv("MINDSENCE_FISH_VOICE", "").strip() or VOICE_SARAH


def wanted(lang):
    """True when Fish Audio should be tried for this language right now."""
    code = (lang or "en").split("-")[0].lower()
    return bool(api_key()) and code in enabled_langs() and time.time() >= _pause_until[0]


_pause_until = [0.0]
_lock = threading.Lock()


def _pause(seconds, why):
    with _lock:
        _pause_until[0] = time.time() + seconds
    log.warning("Fish Audio paused for %ds (%s); using the fallback voice meanwhile", seconds, why)


_slow = [0]          # consecutive replies that took longer than the speed limit


def _note_latency(seconds):
    """Speech must start fast. If Fish keeps taking longer than the limit, it is switched off for ten minutes and the faster
    Microsoft voice is used meanwhile; a fast reply resets the count."""
    if seconds > SPEED_LIMIT:
        _slow[0] += 1
        if _slow[0] >= 2:
            _slow[0] = 0
            _pause(600, "slower than %.1fs per sentence" % SPEED_LIMIT)
    else:
        _slow[0] = 0


def synthesize(text, lang, extra_rate=0):
    """Returns MP3 bytes, or raises. The caller catches and falls back."""
    speed = max(0.5, min(2.0, 1.0 + int(extra_rate) / 100.0 + 0.04))     # same idea as the Microsoft voice: the base is a touch faster than 1.0
    body = json.dumps({
        "text": text, "reference_id": voice_for(lang), "format": "mp3", "mp3_bitrate": 128,
        "latency": FISH_LATENCY, "normalize": True, "prosody": {"speed": round(speed, 2)},
    }).encode("utf-8")
    req = urllib.request.Request(FISH_URL, data=body, method="POST", headers={
        "Authorization": "Bearer " + api_key(), "Content-Type": "application/json", "model": FISH_MODEL,
    })
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=min(FISH_TIMEOUT, SPEED_LIMIT * 2.5)) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        if e.code in (401, 402, 403):
            _pause(900, "HTTP %d - check the key or the credit" % e.code)
        elif e.code in (429, 503):
            _pause(60, "HTTP %d - busy" % e.code)
        raise RuntimeError("Fish Audio HTTP %d" % e.code) from None          # never include the request (it holds the key)
    except Exception as e:
        _pause(30, type(e).__name__)
        raise RuntimeError("Fish Audio unreachable") from None
    if len(audio) < 200:
        raise RuntimeError("Fish Audio returned no audio")
    _note_latency(time.time() - t0)
    return audio
