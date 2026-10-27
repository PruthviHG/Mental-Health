"""Mindsence backend: one small Flask app that serves the page AND the API.

Run it with `python app.py`, then open http://localhost:5000. Nothing else to install or start.

Endpoints
  GET  /                  -> the web app (index.html, style.css, js/, assets/)
  GET  /health            -> service status (which model is active, whether emotion analysis is installed)
  POST /chat              -> streams the companion's reply (Claude, any OpenAI-compatible API, or Ollama)
  POST /tts               -> neural text-to-speech (edge-tts) in the person's language, returned as MP3
  POST /analyze-emotion   -> OPTIONAL speech emotion (Wav2Vec2) from an uploaded audio clip
  POST /feedback          -> append feedback to a local JSONL file

Configuration is read from environment variables or a .env file next to this script (see .env.example).
"""
import asyncio
import gzip
import hashlib
import importlib.util
import json
import logging
import os
import re
import tempfile
import threading
import time
from collections import deque
from datetime import datetime, timezone
from urllib.parse import quote

import edge_tts
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context
from flask_cors import CORS
from werkzeug.utils import safe_join

import auth
import llm_providers
import mailer
from prompts import build_system_prompt, clean_context

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mindsence")

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_dotenv_file(path):
    """Tiny .env reader (so Windows users need no `export`). Real environment variables win."""
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


load_dotenv_file(os.path.join(ROOT, ".env"))

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
HOST = os.getenv("MINDSENCE_HOST") or ("0.0.0.0" if os.getenv("PORT") else "127.0.0.1")   # hosting platforms set PORT
PORT = int(os.getenv("MINDSENCE_PORT") or os.getenv("PORT") or "5000")
# Default: any localhost / 127.0.0.1 port (Live Server, http.server, Vite...) plus file:// ("null").
# The page itself is served from this same server, so it needs no CORS at all.
# Set MINDSENCE_ALLOWED_ORIGINS to a comma-separated list (or "*") to override.
_origins_env = os.getenv("MINDSENCE_ALLOWED_ORIGINS", "").strip()
if _origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", "null"]
EMOTION_MODEL = os.getenv("MINDSENCE_EMOTION_MODEL", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
TTS_VOICE = os.getenv("MINDSENCE_TTS_VOICE", "en-GB-SoniaNeural")      # used for English and unknown languages
TTS_RATE = os.getenv("MINDSENCE_TTS_RATE", "+4%")
TTS_PITCH = os.getenv("MINDSENCE_TTS_PITCH", "+0Hz")
FEEDBACK_FILE = os.getenv("MINDSENCE_FEEDBACK_FILE", "feedback_log.jsonl")
CHAT_RATE_LIMIT = int(os.getenv("MINDSENCE_CHAT_RATE_LIMIT", "30"))     # requests per minute per client IP
CHAT_TEMPERATURE = float(os.getenv("MINDSENCE_TEMPERATURE", "0.7"))

# One calm neural voice per supported language (Microsoft Edge voices).
TTS_VOICES = {
    "hi": "hi-IN-SwaraNeural", "kn": "kn-IN-SapnaNeural", "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural", "bn": "bn-IN-TanishaaNeural", "mr": "mr-IN-AarohiNeural",
    "es": "es-ES-ElviraNeural", "fr": "fr-FR-DeniseNeural", "de": "de-DE-KatjaNeural",
    "pt": "pt-BR-FranciscaNeural", "ar": "ar-SA-ZariyahNeural", "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
}

MAX_TTS_CHARS = 1000
MAX_FEEDBACK_CHARS = 2000
MAX_AUDIO_SECONDS = 20
MIN_AUDIO_SECONDS = 0.5
MAX_CHAT_MESSAGES = 40
MAX_CHAT_CHARS = 4000
MAX_CHAT_TOTAL_CHARS = 24000
MAX_REPLY_TOKENS = 400
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LANG_RE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB upload cap
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0           # always serve the latest files
CORS(app, origins="*" if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS)

app.register_blueprint(auth.bp)

_feedback_lock = threading.Lock()


@app.after_request
def _security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "no-referrer")
    return resp


def emotion_available():
    """Emotion analysis needs torch + transformers + librosa. They are optional (see requirements-emotion.txt)."""
    return all(importlib.util.find_spec(m) is not None for m in ("torch", "transformers", "librosa"))


def voice_for(lang):
    code = (lang or "").split("-")[0].lower()
    return TTS_VOICES.get(code, TTS_VOICE)


# ------------------------------------------------------------------
# 1. Speech emotion recognition (lazy-loaded Wav2Vec2)
# ------------------------------------------------------------------
_emotion = {"bundle": None, "error": None}
_emotion_lock = threading.Lock()

_HEAD_KEYS = ("classifier.dense.weight", "classifier.dense.bias", "classifier.output.weight", "classifier.output.bias")


def _load_checkpoint_state(repo):
    """Raw tensors from the checkpoint (we need the classifier head transformers would discard)."""
    from huggingface_hub import hf_hub_download
    try:
        from safetensors.torch import load_file
        return load_file(hf_hub_download(repo, "model.safetensors"))
    except Exception:
        import torch
        return torch.load(hf_hub_download(repo, "pytorch_model.bin"), map_location="cpu")


def _build_emotion_model():
    """Load encoder + the model's own classifier head.

    ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition was trained with a custom head
    (mean-pool -> dense -> tanh -> output). The stock Wav2Vec2ForSequenceClassification does not
    have these layers, so loading through it silently RANDOMISES the head (the
    "classifier.dense.* UNEXPECTED / classifier.weight MISSING" warning) and predictions are noise.
    """
    import torch
    from transformers import AutoConfig, Wav2Vec2FeatureExtractor, Wav2Vec2Model

    # Leave CPU for the browser and the rest of the machine; wav2vec2 on every core makes the whole PC feel frozen.
    torch.set_num_threads(int(os.getenv("MINDSENCE_TORCH_THREADS", "2")))

    config = AutoConfig.from_pretrained(EMOTION_MODEL)
    extractor = Wav2Vec2FeatureExtractor.from_pretrained(EMOTION_MODEL)
    encoder = Wav2Vec2Model.from_pretrained(EMOTION_MODEL).eval()

    state = _load_checkpoint_state(EMOTION_MODEL)
    missing = [k for k in _HEAD_KEYS if k not in state]
    if missing:
        raise RuntimeError(f"Checkpoint has no classifier head weights {missing}; "
                           "set MINDSENCE_EMOTION_MODEL to a compatible model.")

    n_labels = len(config.id2label)
    hidden = config.hidden_size
    if tuple(state["classifier.output.weight"].shape) != (n_labels, hidden):
        raise RuntimeError("Classifier head shape does not match the model config.")

    dense = torch.nn.Linear(hidden, hidden)
    output = torch.nn.Linear(hidden, n_labels)
    dense.load_state_dict({"weight": state["classifier.dense.weight"], "bias": state["classifier.dense.bias"]})
    output.load_state_dict({"weight": state["classifier.output.weight"], "bias": state["classifier.output.bias"]})

    id2label = {int(k): v for k, v in config.id2label.items()}
    return {"extractor": extractor, "encoder": encoder, "dense": dense.eval(), "output": output.eval(), "id2label": id2label}


def get_emotion_model():
    """Load once, on first use (keeps startup and tests fast)."""
    if _emotion["bundle"] is None:
        with _emotion_lock:
            if _emotion["bundle"] is None:
                try:
                    log.info("Loading emotion model %s ...", EMOTION_MODEL)
                    _emotion["bundle"] = _build_emotion_model()
                    _emotion["error"] = None
                    log.info("Emotion model ready.")
                except Exception as exc:
                    _emotion["error"] = str(exc)
                    log.exception("Emotion model failed to load")
                    raise
    return _emotion["bundle"]


def classify_audio(path):
    """Return {"emotion", "confidence", "scores"} for an audio file path."""
    import librosa
    import torch

    speech, _ = librosa.load(path, sr=16000, mono=True, duration=MAX_AUDIO_SECONDS)
    if speech.size < 16000 * MIN_AUDIO_SECONDS:
        raise ValueError("Audio is too short to analyse")

    m = get_emotion_model()
    inputs = m["extractor"](speech, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        feats = m["encoder"](inputs.input_values).last_hidden_state.mean(dim=1)   # mean pooling over time
        logits = m["output"](torch.tanh(m["dense"](feats)))
    probs = torch.softmax(logits, dim=-1)[0]

    scores = {m["id2label"][i]: round(float(p), 4) for i, p in enumerate(probs)}
    label = max(scores, key=scores.get)
    return {"emotion": label, "confidence": scores[label], "scores": scores}


@app.route("/analyze-emotion", methods=["POST"])
@auth.login_required
def analyze_emotion():
    if not emotion_available():
        return jsonify({"error": "Voice emotion analysis is not installed (optional: pip install -r requirements-emotion.txt)"}), 501
    upload = request.files.get("audio")
    if upload is None:
        return jsonify({"error": "No audio file provided"}), 400

    # Browsers record webm/ogg/mp4, not real WAV: decode from a temp file (needs ffmpeg for some formats).
    suffix = os.path.splitext(upload.filename or "")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        upload.save(tmp)
        tmp.close()
        return jsonify(classify_audio(tmp.name))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        log.exception("Emotion analysis failed")
        return jsonify({"error": "Could not analyse audio"}), 500
    finally:
        try:
            tmp.close()
            os.remove(tmp.name)
        except OSError:
            pass


# ------------------------------------------------------------------
# 2. Neural TTS (edge-tts), streamed into memory (no temp files to leak)
# ------------------------------------------------------------------
def rate_string(extra=0):
    """Base voice speed (MINDSENCE_TTS_RATE) plus a per-request extra, clamped to a natural-sounding range."""
    try:
        base = int(str(TTS_RATE).replace("%", "").replace("+", "").strip() or 0)
    except ValueError:
        base = 0
    return f"{max(-25, min(30, base + int(extra))):+d}%"


async def synthesize(text, voice=None, extra_rate=0):
    # Speed is changed by the voice engine itself, so the pitch stays natural (no "chipmunk" effect).
    communicate = edge_tts.Communicate(text=text, voice=voice or TTS_VOICE, rate=rate_string(extra_rate), pitch=TTS_PITCH)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


class AudioCache:
    """Small in-memory LRU for synthesized speech. The greeting, check-ins and crisis message repeat for everyone,
    so after the first time they play instantly and cost no round trip to the voice service."""

    def __init__(self, max_items=200, max_bytes=32 * 1024 * 1024):
        self.max_items, self.max_bytes, self.size, self.items, self.lock = max_items, max_bytes, 0, {}, threading.Lock()

    def get(self, key):
        with self.lock:
            audio = self.items.pop(key, None)
            if audio is not None:
                self.items[key] = audio                      # most recently used goes last
            return audio

    def put(self, key, audio):
        if not audio or len(audio) > self.max_bytes // 4:
            return
        with self.lock:
            if key in self.items:
                self.size -= len(self.items.pop(key))
            self.items[key] = audio
            self.size += len(audio)
            while self.items and (len(self.items) > self.max_items or self.size > self.max_bytes):
                oldest = next(iter(self.items))
                self.size -= len(self.items.pop(oldest))


audio_cache = AudioCache()


def synthesize_cached(text, voice, extra_rate=0):
    key = (voice, text, extra_rate)
    audio = audio_cache.get(key)
    if audio is None:
        audio = asyncio.run(synthesize(text, voice, extra_rate))
        audio_cache.put(key, audio)                          # failures raise before this line, so they are never cached
    return audio


@app.route("/tts", methods=["POST"])
@auth.login_required
def tts():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    lang = data.get("lang")
    extra = data.get("rate", 0)
    if isinstance(extra, bool) or not isinstance(extra, (int, float)):
        extra = 0
    extra = int(max(0, min(24, extra)))                    # how much faster than normal (the app asks for more when speech lags behind the text)
    if not text:
        return jsonify({"error": "No text provided"}), 400
    if len(text) > MAX_TTS_CHARS:
        return jsonify({"error": f"Text too long (max {MAX_TTS_CHARS} characters)"}), 400
    if lang is not None and not (isinstance(lang, str) and LANG_RE.match(lang)):
        return jsonify({"error": "Invalid language code"}), 400

    try:
        audio = synthesize_cached(text, voice_for(lang), extra)
    except Exception:
        log.exception("TTS failed")
        # The browser then falls back to its own built-in voice, so speech still works offline.
        return jsonify({"error": "Speech synthesis failed (is the machine online?)"}), 502
    if not audio:
        return jsonify({"error": "Speech synthesis returned no audio"}), 502

    return Response(audio, mimetype="audio/mpeg", headers={"Cache-Control": "no-store"})


# ------------------------------------------------------------------
# 2b. Chat (streams plain UTF-8 text; the browser shows it as it arrives)
# ------------------------------------------------------------------
class RateLimiter:
    """Sliding-window limiter, per key, in memory. Protects a shared API key from being drained."""

    def __init__(self, limit, window=60.0):
        self.limit, self.window = limit, window
        self.hits = {}
        self.lock = threading.Lock()

    def allow(self, key, now=None):
        if self.limit <= 0:
            return True
        now = time.monotonic() if now is None else now
        with self.lock:
            q = self.hits.setdefault(key, deque())
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            if len(self.hits) > 5000:                      # forget idle clients
                for k in [k for k, v in self.hits.items() if not v or now - v[-1] > self.window]:
                    self.hits.pop(k, None)
            return True


chat_limiter = RateLimiter(CHAT_RATE_LIMIT)


def parse_chat_messages(raw):
    """Validate and normalise the conversation. Returns (messages, error)."""
    if not isinstance(raw, list) or not raw:
        return None, "messages must be a non-empty list"
    out, total = [], 0
    for m in raw[-MAX_CHAT_MESSAGES:]:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant") or not isinstance(m.get("content"), str):
            return None, "each message needs a role (user/assistant) and text content"
        text = m["content"].strip()
        if not text:
            continue
        if len(text) > MAX_CHAT_CHARS:
            return None, f"a message is too long (max {MAX_CHAT_CHARS} characters)"
        total += len(text)
        out.append({"role": m["role"], "content": text})
    while out and out[0]["role"] != "user":               # providers require the first turn to be the person's
        out.pop(0)
    if not out or out[-1]["role"] != "user":
        return None, "the last message must be from the user"
    if total > MAX_CHAT_TOTAL_CHARS:
        return None, "conversation is too long"
    return out, None


def _client_key():
    user = auth.current_user()
    return f"user:{user['id']}" if user else (request.remote_addr or "unknown")


@app.route("/chat", methods=["POST"])
@auth.login_required
def chat():
    data = request.get_json(silent=True) or {}
    messages, error = parse_chat_messages(data.get("messages"))
    if error:
        return jsonify({"error": "bad_request", "detail": error}), 400
    if not chat_limiter.allow(_client_key()):
        return jsonify({"error": "rate_limited", "detail": "Too many messages, please slow down a little."}), 429

    cfg = llm_providers.get_llm_config(os.environ)
    if cfg["provider"] == "none":
        return jsonify({"error": "no_llm", "detail": cfg.get("reason", "")}), 503

    ctx = clean_context(data.get("context"))
    system = build_system_prompt(ctx)
    try:
        base = int(data.get("maxTokens") or 220)
    except (TypeError, ValueError):
        base = 220
    max_tokens = min(llm_providers.token_budget(ctx["lang"], max(32, base)), MAX_REPLY_TOKENS * 2)

    gen = llm_providers.stream_chat(cfg, system, messages, max_tokens, CHAT_TEMPERATURE)
    try:
        first = next(gen)                                  # surface auth / network errors as a proper HTTP error
    except StopIteration:
        return Response("", mimetype="text/plain", headers={"Cache-Control": "no-store"})
    except llm_providers.LLMError as err:
        log.warning("LLM error (%s): %s", cfg["provider"], err)
        return jsonify({"error": err.code}), err.status

    def body():
        yield first
        try:
            for piece in gen:
                yield piece
        except llm_providers.LLMError as err:               # mid-stream failure: keep what was already sent
            log.warning("LLM stream ended early (%s): %s", cfg["provider"], err)

    return Response(stream_with_context(body()), mimetype="text/plain; charset=utf-8",
                    headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------
# 3. Feedback: saved to a local file first (never lost), then e-mailed in the background
# ------------------------------------------------------------------
feedback_limit = auth.Window(5, 600)      # per signed-in account: 5 messages / 10 minutes
FEEDBACK_ASYNC = True                     # tests switch this off to deliver inline
FEEDBACK_RETRY_SECONDS = (0, 3, 10)


def deliver_feedback(entry, user):
    """E-mail one feedback entry. Returns True on success. The destination address is never logged or returned.
    With a Gmail/SMTP account configured it is sent from there; otherwise through the built-in relay (no setup)."""
    who = f"{user.get('name') or '(no name)'} <{user.get('email')}>"
    body = (f"Time:      {entry['time']}\nAccount:   {who}\nContact:   {entry['email'] or '(none given)'}\n"
            f"Language:  {entry.get('lang') or '(unknown)'}\n\n{entry['text']}\n")
    subject = "[Mindsence feedback] " + mailer.one_line(entry["text"], 60)
    use_smtp = mailer.configured() and (os.environ.get("MINDSENCE_FEEDBACK_VIA") or "").lower() != "relay"
    for wait in FEEDBACK_RETRY_SECONDS:
        if wait:
            time.sleep(wait)
        try:
            if use_smtp:
                mailer.send(mailer.feedback_inbox(), subject, body, reply_to=entry["email"] or None)
            else:
                mailer.relay(mailer.feedback_inbox(), subject, body, reply_to=entry["email"] or None)
            return True
        except mailer.NeedsActivation:
            log.warning("Feedback relay is waiting for its one-time activation e-mail to be confirmed by the inbox owner.")
        except Exception as e:
            log.warning("Feedback e-mail attempt failed: %s", type(e).__name__)
    log.error("Feedback e-mail could not be sent; it is saved in %s", FEEDBACK_FILE)
    return False


@app.route("/feedback", methods=["POST"])
@auth.login_required
def feedback():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    text = str(data.get("text", "")).strip()
    lang = str(data.get("lang", ""))[:8]
    user = auth.current_user()

    if not text:
        return jsonify({"error": "Feedback text is required"}), 400
    if len(text) > MAX_FEEDBACK_CHARS:
        return jsonify({"error": f"Feedback too long (max {MAX_FEEDBACK_CHARS} characters)"}), 400
    if email and not EMAIL_RE.match(email):
        return jsonify({"error": "Invalid email address"}), 400
    if not feedback_limit.allow(user["id"]):
        return jsonify({"error": "Too many messages just now. Please try again in a few minutes."}), 429

    entry = {"time": datetime.now(timezone.utc).isoformat(), "email": email or None, "lang": lang or None, "text": text}
    saved = True
    try:
        with _feedback_lock:
            with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps({**entry, "account": user.get("email")}, ensure_ascii=False) + "\n")
    except OSError:
        log.exception("Could not write the feedback file")
        saved = False

    if FEEDBACK_ASYNC:
        threading.Thread(target=deliver_feedback, args=(entry, user), daemon=True).start()
    elif not deliver_feedback(entry, user) and not saved:
        return jsonify({"error": "Could not save your feedback. Please try again."}), 500
    if FEEDBACK_ASYNC and not saved:
        pass                                                   # the background e-mail may still deliver it
    return jsonify({"status": "success", "message": "Thank you. Your feedback was received."})


# ------------------------------------------------------------------
# The web app itself (only these paths are public; app.py, .env and the feedback log are not)
# ------------------------------------------------------------------
# Libraries the page can load from this server instead of the internet. `python tools/get_vendor.py` downloads them once
# (run.bat does it for you). Where a local copy exists the page uses it (faster, works offline); otherwise the CDN is used.
VENDOR_SWAPS = (
    ('src="https://cdn.tailwindcss.com"', 'src="assets/vendor/tailwind.js"', "tailwind.js"),
    ('href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"', 'href="assets/vendor/fa/css/all.min.css"', "fa/css/all.min.css"),
    ('href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;700&display=swap"', 'href="assets/vendor/fonts/fonts.css"', "fonts/fonts.css"),
    ('src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"', 'src="assets/vendor/three.min.js"', "three.min.js"),
)


def render_index():
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        html = f.read()
    for cdn, local, rel in VENDOR_SWAPS:
        if os.path.isfile(os.path.join(ROOT, "assets", "vendor", rel)):
            html = html.replace(cdn, local, 1)
    return html


_gzip_cache = {}


def text_response(data, mimetype):
    """Pages, styles and scripts: compressed (the 14 language packs shrink about 4x) and revalidated with an ETag, so a
    repeat visit costs one tiny 304 per file instead of a full download."""
    etag = '"' + hashlib.sha1(data).hexdigest()[:20] + '"'
    headers = {"ETag": etag, "Cache-Control": "no-cache", "Vary": "Accept-Encoding"}
    if request.headers.get("If-None-Match") == etag:
        return Response(status=304, headers=headers)
    if "gzip" in request.headers.get("Accept-Encoding", "") and len(data) > 1024:
        packed = _gzip_cache.get(etag)
        if packed is None:
            if len(_gzip_cache) > 200:
                _gzip_cache.clear()
            packed = _gzip_cache[etag] = gzip.compress(data, 6, mtime=0)
        data = packed
        headers["Content-Encoding"] = "gzip"
    return Response(data, mimetype=mimetype, headers=headers)


def static_text(directory, name, mimetype):
    path = safe_join(directory, name)
    if not path or not os.path.isfile(path):
        return jsonify({"error": "Not found"}), 404
    with open(path, "rb") as f:
        return text_response(f.read(), mimetype)


@app.route("/")
def index():
    return text_response(render_index().encode("utf-8"), "text/html")


@app.route("/style.css")
def stylesheet():
    return static_text(ROOT, "style.css", "text/css")


@app.route("/js/<path:name>")
def scripts(name):
    if not name.endswith(".js"):
        return jsonify({"error": "Not found"}), 404
    return static_text(os.path.join(ROOT, "js"), name, "text/javascript")


MUSIC_EXTS = (".mp3", ".ogg", ".wav", ".m4a")


@app.route("/music")
def music_list():
    """Tracks you put in assets/music/ (no GitHub, no CORS trouble, works offline). Empty list = the player uses its other sources."""
    folder = os.path.join(ROOT, "assets", "music")
    try:
        names = sorted((n for n in os.listdir(folder) if n.lower().endswith(MUSIC_EXTS) and os.path.isfile(os.path.join(folder, n))), key=str.lower)
    except OSError:
        names = []
    tracks = [{"name": os.path.splitext(n)[0].replace("_", " ").replace("-", " ").strip()[:80], "url": "/assets/music/" + quote(n)} for n in names[:200]]
    return jsonify({"tracks": tracks}), 200, {"Cache-Control": "no-cache"}


@app.route("/assets/<path:name>")
def assets(name):
    resp = send_from_directory(os.path.join(ROOT, "assets"), name)
    if name.startswith("vendor/"):                           # versioned third-party files never change
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp


# ------------------------------------------------------------------
# Misc
# ------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "llm": llm_providers.public_info(llm_providers.get_llm_config(os.environ)),
        "emotion_available": emotion_available(),
        "emotion_model_loaded": _emotion["bundle"] is not None,
        "emotion_model_error": _emotion["error"],
        "tts_voice": TTS_VOICE,
        "auth": {"required": True, "google": bool(auth.google_client_id())},
    })


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Upload too large"}), 413


def _banner():
    cfg = llm_providers.get_llm_config(os.environ)
    shown = "localhost" if HOST in ("127.0.0.1", "0.0.0.0") else HOST
    print(f"\n  Mindsence is running:  http://{shown}:{PORT}")
    if cfg["provider"] == "none":
        print("  AI model: none configured -> SIMPLE MODE (built-in, offline).")
        print("            Easiest: run  python tools/setup_ai.py  (installs a small free local AI), or add ANTHROPIC_API_KEY / OPENAI_API_KEY to .env.")
    else:
        where = "on this machine" if cfg["mode"] == "local" else "via the cloud provider"
        print(f"  AI model: {cfg['label']} ({cfg['provider']}, {where})")
    print(f"  Voice emotion analysis: {'on' if emotion_available() else 'off (optional, see requirements-emotion.txt)'}\n")


if __name__ == "__main__":
    if emotion_available() and os.getenv("MINDSENCE_LAZY_MODEL") != "1":
        # Warm the model in the background so the first voice message isn't slow.
        def _preload():
            try:
                get_emotion_model()
            except Exception:
                pass            # logged; /health reports it, voice chat keeps working without emotion
        threading.Thread(target=_preload, daemon=True).start()
    _banner()
    _cfg = llm_providers.get_llm_config(os.environ)
    if _cfg["provider"] == "ollama":
        threading.Thread(target=llm_providers.warm_up, args=(_cfg,), daemon=True).start()     # first reply is not slow
    app.run(host=HOST, port=PORT, threaded=True)
