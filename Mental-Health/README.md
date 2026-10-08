# 🤍 Mindsence — Safe Space

A private, fully local AI companion for mental wellness. Mindsence is a voice-and-text chat friend that listens to *how* you sound (not just what you say), replies in a soft, healing voice, and surrounds you with calming visuals, ambient music, immersive video rooms, and mindful mini-games.

Everything runs on your own machine: the LLM (Ollama), speech-emotion model, and text-to-speech backend. No chat data is sent to a cloud AI provider.

> ⚠️ **Mindsence is a wellness companion, not a medical or crisis service.** It is not a substitute for a therapist, doctor, or emergency help. If you or someone you know is in crisis, please contact a local helpline or emergency services (India: Tele-MANAS **14416**; US: **988**).

---

## ✨ Features

| Area | What it does |
|---|---|
| **Chat companion** | Streaming conversation with a local LLM (`llama3.2:3b` via Ollama's `/api/chat`). It **remembers the conversation** (rolling window) and replies in a warm, texting-style voice that mirrors your message length. |
| **Crisis safety net** | Messages that suggest self-harm or suicide **never reach the LLM**. Mindsence shows a fixed, caring response with helplines, switches to a no-jokes "care mode" for the next turns, and a **NEED HELP?** button is always in the header. |
| **Live voice chat** | Tap the mic to talk. Browser Speech Recognition transcribes you, and the AI answers out loud. Speaking over the AI interrupts it. |
| **Voice emotion detection** | Your recorded audio is sent to a local Wav2Vec2 model (`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`). Emotion and confidence are shown as a badge and passed to the model only when the reading is fresh and confident enough. |
| **Healing voice (TTS)** | Neural TTS through `edge-tts` (`en-GB-SoniaNeural`, slowed rate and lowered pitch). Bracket cues like `[sigh]`, `[hmm]`, `[laugh]` become spoken fillers and are hidden from the chat text. |
| **Idle check-ins** | After 5 minutes of silence, Mindsence gently checks in ("Did you have food yet?"). |
| **3D background** | A Three.js particle sphere that pulses with the bass of the music and reacts to your mouse. Particle count scales down on mobile. |
| **Audio sync player** | Ambient nature/lofi tracks loaded from this repo's `Only Musics/` folder through the GitHub API, with crossfade, next/prev, and automatic muting while the AI speaks. |
| **Rooms** | Full-screen looping video environments (golden hour, study, lofi, rain, space, nature, anime, treehouse, bath, and more) with a firefly particle overlay and a mini music player. |
| **Games hub** | 11 canvas mini-games for decompressing: Neon Surge, Neon Reflex, Quantum Snake, Pulse Defender, Neon Breaker, Hyper Dash, **Block Blast**, Zen Hike, Neon Farm, **Box Breathing**, and **Desk Yoga**. |
| **Export log** | Download your conversation as a text file. |
| **Feedback widget** | In-app feedback form, validated and stored locally by the backend (JSON Lines). |
| **Service status** | The header shows whether Ollama and the voice backend are reachable (ONLINE / TEXT ONLY / LLM OFFLINE). |
| **Mobile friendly** | Responsive layout, safe text sizing, and touch-aware canvases. |

---

## 🧱 Tech Stack

- **Frontend:** HTML, Tailwind CSS (CDN), vanilla JavaScript, Three.js r128, Canvas 2D, Web Speech API, Web Audio API, Font Awesome
- **Backend:** Python, Flask, Flask-CORS (lazy-loaded models, env-based config)
- **AI / ML:** Ollama (`llama3.2:3b`), Hugging Face Transformers (Wav2Vec2), PyTorch, librosa
- **Voice:** edge-tts (Microsoft neural voices)
- **Quality:** pytest (backend), Node test runner + jsdom (frontend), GitHub Actions CI

---

## 🏗️ Architecture

```
┌───────────────────────────── Browser (index.html + script.js) ─────────────────────────────┐
│  Mic → Web Speech API (text)                                                               │
│      → MediaRecorder (audio) ───────────────┐                                              │
│  Chat UI · Three.js · Rooms · Games · Music │                                              │
└───────┬──────────────────────┬──────────────┼──────────────────────────────────────────────┘
        │ prompt + system      │ text         │ audio
        ▼                      ▼              ▼
  Ollama :11434          Flask :5000/tts   Flask :5000/analyze-emotion
  (llama3.2:3b)          (edge-tts → mp3)  (Wav2Vec2 → emotion label)
```

### Backend API (`app.py`, port 5000)

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/health` | GET | n/a | `{ "status": "ok", "emotion_model_loaded": bool }` |
| `/analyze-emotion` | POST | `multipart/form-data` with `audio` | `{ "emotion", "confidence", "scores" }` |
| `/tts` | POST | `{ "text": "..." }` (max 1000 chars) | `audio/mpeg` |
| `/feedback` | POST | `{ "email": "...", "text": "..." }` | `{ "status": "success" }`; appends to `feedback_log.jsonl` |

---

## 📁 Project Structure

```
Mental-Health/
├── index.html            # UI layout: chat, player, Rooms, Games, help modal
├── style.css             # Neon theme, player, arcade, rooms, crisis/help styles
├── js/
│   ├── config.js         # All URLs/model/tuning in one place (overridable)
│   ├── core.js           # Global state + interruption (stopAI)
│   ├── safety.js         # Crisis detection, helplines, help modal
│   ├── voice.js          # Speech recognition + voice-emotion client
│   ├── tts.js            # Text-to-speech playback
│   ├── llm.js            # Ollama chat, history, system prompt, status check
│   ├── chat.js           # Chat UI and send flow
│   ├── audio.js          # Ambient music engine
│   ├── scene3d.js        # Three.js particle background
│   ├── rooms.js          # Video rooms + fireflies
│   ├── mime.js           # MIME: small chat popup inside Rooms
│   ├── games.js          # 11 mini-games
│   ├── idle.js           # Idle check-ins
│   └── feedback.js       # Feedback widget
├── app.py                # Flask backend: emotion, TTS, feedback, health
├── tests/                # pytest (backend) + node/jsdom (frontend)
├── requirements.txt / requirements-dev.txt
├── .env.example          # Backend settings
├── .github/workflows/ci.yml
├── assets/               # Room videos
├── Only Musics/          # Ambient audio
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- [Ollama](https://ollama.com/) installed and running
- A modern Chromium-based browser (Chrome or Edge) for speech recognition
- `ffmpeg` on your PATH (helps librosa decode audio)
- A decent CPU, or a GPU for faster inference. The first run downloads the Wav2Vec2 model (~1.2 GB).

### 1. Clone

```bash
git clone https://github.com/PruthviHG/Mental-Health.git
cd Mental-Health
```

### 2. Set up the Python backend

```bash
python -m venv venv
# Windows: venv\Scripts\activate
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

The backend starts on `http://127.0.0.1:5000` (local only by default; see `.env.example`).

### 3. Set up the local LLM

```bash
ollama pull llama3.2:3b
ollama serve        # skip if Ollama is already running
```

Want a different model? Change `LOCAL_MODEL` in `script.js` (for example `mistral:7b`).

### 4. Run the frontend

Serve the folder over HTTP (browser speech recognition won't work from `file://`):

```bash
python -m http.server 8000
```

Open **http://localhost:8000** in Chrome or Edge and allow microphone access.

---

## 🎮 Usage

- **Chat:** type and press send. Start typing anywhere on the page and the input focuses automatically.
- **Voice mode:** click the 🎤 button. It pulses while live. Talk naturally; speaking while the AI is replying interrupts it.
- **Music:** click **🎵 AUDIO SYNC** (bottom-left) for the player.
- **Rooms:** header → **ROOMS** → pick an environment. Use the arrow to go back and the step button for the next scene. Press **MIME** to chat (text or mic) in a small popup over the room without leaving it.
- **Games:** header → **GAMES** → pick a game. Try **Box Breathing** (4-4-4-4) or **Desk Yoga** when you need a reset.
- **Export:** header → **EXPORT LOG** (desktop).
- **Feedback:** the ✉️ button (bottom-right).

---

## ⚙️ Configuration

All the knobs are at the top of `script.js` and `app.py`:

Frontend settings live in `js/config.js`. Override any of them before the scripts load:

```html
<script>window.MINDSENCE_CONFIG = { model: "mistral:7b", maxHistoryMessages: 30 };</script>
```

| Setting | Default |
|---|---|
| `model` | `llama3.2:3b` |
| `ollamaUrl` / `backendUrl` | `http://127.0.0.1:11434` / `http://127.0.0.1:5000` |
| `temperature` / `topP` / `maxReplyTokens` | `0.7` / `0.9` / `220` |
| `maxHistoryMessages` | `24` (rolling memory sent to the model) |
| `emotionMinConfidence` / `emotionMaxAgeMs` | `0.4` / `30000` |
| `crisisModeTurns` | `10` |

Backend settings are environment variables (voice, rate, pitch, CORS origins, port, feedback file); see `.env.example`. The personality is `SYSTEM_PROMPT` in `js/llm.js`.

---|---|---|
| `LOCAL_MODEL` | `script.js` | `llama3.2:3b` |
| `OLLAMA_API_URL` | `script.js` | `http://127.0.0.1:11434/api/generate` |
| `LOCAL_BACKEND_URL` | `script.js` | `http://127.0.0.1:5000` |
| `temperature` / `top_p` / `num_predict` | `script.js` | `0.8` / `0.9` / `150` |
| Idle check-in delay | `script.js` | 300000 ms (5 min) |
| TTS voice, rate, pitch | `app.py` | `en-GB-SoniaNeural`, `-20%`, `-10Hz` |
| Personality | `systemPromptBase` in `script.js` | "Mindsence" healing-friend persona |

---

## 🔒 Privacy

- The chat LLM, emotion model, and TTS backend all run locally.
- Exception: `edge-tts` calls Microsoft's online neural voice service to synthesize speech, so the text of AI replies is sent there. Browser speech recognition in Chrome may also use Google's servers.
- Conversation memory lives only in the browser tab (cleared on refresh or with **CLEAR**). Nothing is persisted.
- Feedback is stored only in `feedback_log.jsonl` on the machine running the backend. The backend binds to `127.0.0.1` and restricts CORS to local origins by default.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `[LOCAL MODEL OFFLINE - CHECK OLLAMA]` in chat | Make sure `ollama serve` is running and the model is pulled. |
| No voice / mic does nothing | Serve over `http://localhost`, use Chrome or Edge, and allow mic permission. |
| Emotion badge never appears | Install `ffmpeg` (browsers record WebM/MP4 audio) and check `/health` shows the backend is up. |
| No AI voice | Check that `python app.py` is running and you're online (edge-tts needs internet). |
| Emotion always "neutral" | Backend isn't reachable on port 5000, or the emotion model is still downloading. |
| Rooms or music empty | The player and Rooms fetch file lists from the GitHub API, which is rate-limited when unauthenticated. Wait a bit and refresh. |
| Slow on phones | The 3D particle count is already reduced on small screens; close the Rooms/Games overlays when idle. |

---

## 🧪 Testing

```bash
pip install -r requirements-dev.txt && pytest -q      # backend (no GPU or model download needed)
npm install && npm test                                # frontend: crisis detection + chat flow in jsdom
```

CI runs both on every push.

## 🛡️ Safety design

- Crisis detection (`js/safety.js`) runs **before** the LLM, so a small local model can never respond to self-harm statements with a joke. It is deliberately broad: a false alarm costs one caring message.
- The system prompt forbids joking about self-harm, diagnosing, or discouraging human support, and the app repeatedly says it is an AI, not therapy.
- This is a safety net, not a clinical tool. Keyword matching can miss indirect language. Helpline numbers should be re-verified periodically.

## 🗺️ Roadmap

- [ ] Optional encrypted local conversation memory across sessions
- [ ] Multi-language voice, chat and crisis detection
- [ ] Mood journal and weekly emotion trends
- [ ] Packaged one-click launcher for the backend and Ollama
- [ ] Self-host the room videos and music instead of using the GitHub API

---

## 🤝 Contributing

Issues and pull requests are welcome. Fork the repo, create a feature branch, and open a PR describing what you changed.

## 🙏 Credits

- [Ollama](https://ollama.com/) and Meta's Llama 3.2
- [`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`](https://huggingface.co/ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition)
- [edge-tts](https://github.com/rany2/edge-tts), [Three.js](https://threejs.org/), [Tailwind CSS](https://tailwindcss.com/), [Font Awesome](https://fontawesome.com/)
- Ambient audio from Pixabay; room videos and images from their respective creators

## 👤 Author

Built by **Pruthvi H G** — [@PruthviHG](https://github.com/PruthviHG)

---

*Be kind to yourself. 🤍*
