"""Mindsence local backend.

Endpoints
  GET  /health            -> service status
  POST /analyze-emotion   -> speech emotion (Wav2Vec2) from an uploaded audio clip
  POST /tts               -> neural text-to-speech (edge-tts) returned as MP3
  POST /feedback          -> append feedback to a local JSONL file

Configuration is read from environment variables (see .env.example).
"""
import asyncio
import json
import logging
import os
import re
import tempfile
import threading
from datetime import datetime, timezone

import edge_tts
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("mindsence")

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
HOST = os.getenv("MINDSENCE_HOST", "127.0.0.1")   # use 0.0.0.0 only if you really want LAN access
PORT = int(os.getenv("MINDSENCE_PORT", "5000"))
# Default: any localhost / 127.0.0.1 port (Live Server, http.server, Vite...) plus file:// ("null").
# Set MINDSENCE_ALLOWED_ORIGINS to a comma-separated list (or "*") to override.
_origins_env = os.getenv("MINDSENCE_ALLOWED_ORIGINS", "").strip()
if _origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", "null"]
EMOTION_MODEL = os.getenv("MINDSENCE_EMOTION_MODEL", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
TTS_VOICE = os.getenv("MINDSENCE_TTS_VOICE", "en-GB-SoniaNeural")
TTS_RATE = os.getenv("MINDSENCE_TTS_RATE", "-8%")
TTS_PITCH = os.getenv("MINDSENCE_TTS_PITCH", "-5Hz")
FEEDBACK_FILE = os.getenv("MINDSENCE_FEEDBACK_FILE", "feedback_log.jsonl")

MAX_TTS_CHARS = 1000
MAX_FEEDBACK_CHARS = 2000
MAX_AUDIO_SECONDS = 20
MIN_AUDIO_SECONDS = 0.5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB upload cap
CORS(app, origins="*" if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS)

_feedback_lock = threading.Lock()


# ------------------------------------------------------------------
# 1. Speech emotion recognition (lazy-loaded Wav2Vec2)
# ------------------------------------------------------------------
_emotion = {"extractor": None, "model": None}
_emotion_lock = threading.Lock()


def get_emotion_model():
    """Load the model once, on first use (keeps startup and tests fast)."""
    if _emotion["model"] is None:
        with _emotion_lock:
            if _emotion["model"] is None:
                from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForSequenceClassification
                log.info("Loading emotion model %s ...", EMOTION_MODEL)
                _emotion["extractor"] = Wav2Vec2FeatureExtractor.from_pretrained(EMOTION_MODEL)
                model = Wav2Vec2ForSequenceClassification.from_pretrained(EMOTION_MODEL)
                model.eval()
                _emotion["model"] = model
                log.info("Emotion model ready.")
    return _emotion["extractor"], _emotion["model"]


def classify_audio(path):
    """Return {"emotion", "confidence", "scores"} for an audio file path."""
    import librosa
    import torch

    speech, _ = librosa.load(path, sr=16000, mono=True, duration=MAX_AUDIO_SECONDS)
    if speech.size < 16000 * MIN_AUDIO_SECONDS:
        raise ValueError("Audio is too short to analyse")

    extractor, model = get_emotion_model()
    inputs = extractor(speech, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(inputs.input_values).logits
    probs = torch.softmax(logits, dim=-1)[0]

    scores = {model.config.id2label[i]: round(float(p), 4) for i, p in enumerate(probs)}
    label = max(scores, key=scores.get)
    return {"emotion": label, "confidence": scores[label], "scores": scores}


@app.route("/analyze-emotion", methods=["POST"])
def analyze_emotion():
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
async def synthesize(text):
    communicate = edge_tts.Communicate(text=text, voice=TTS_VOICE, rate=TTS_RATE, pitch=TTS_PITCH)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


@app.route("/tts", methods=["POST"])
def tts():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400
    if len(text) > MAX_TTS_CHARS:
        return jsonify({"error": f"Text too long (max {MAX_TTS_CHARS} characters)"}), 400

    try:
        audio = asyncio.run(synthesize(text))
    except Exception:
        log.exception("TTS failed")
        return jsonify({"error": "Speech synthesis failed (is the machine online?)"}), 502
    if not audio:
        return jsonify({"error": "Speech synthesis returned no audio"}), 502

    return Response(audio, mimetype="audio/mpeg", headers={"Cache-Control": "no-store"})


# ------------------------------------------------------------------
# 3. Feedback (JSON Lines, stored locally only)
# ------------------------------------------------------------------
@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    text = str(data.get("text", "")).strip()

    if not text:
        return jsonify({"error": "Feedback text is required"}), 400
    if len(text) > MAX_FEEDBACK_CHARS:
        return jsonify({"error": f"Feedback too long (max {MAX_FEEDBACK_CHARS} characters)"}), 400
    if email and not EMAIL_RE.match(email):
        return jsonify({"error": "Invalid email address"}), 400

    entry = {
        "time": datetime.now(timezone.utc).isoformat(),
        "email": email or None,
        "text": text,
    }
    with _feedback_lock:
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return jsonify({"status": "success", "message": "Feedback saved locally."})


# ------------------------------------------------------------------
# Misc
# ------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "emotion_model_loaded": _emotion["model"] is not None,
        "tts_voice": TTS_VOICE,
    })


@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Upload too large"}), 413


if __name__ == "__main__":
    if os.getenv("MINDSENCE_LAZY_MODEL") != "1":
        # Warm the model in the background so the first voice message isn't slow.
        threading.Thread(target=get_emotion_model, daemon=True).start()
    app.run(host=HOST, port=PORT, threaded=True)
