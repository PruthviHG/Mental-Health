# 🤍 Mindsence — Safe Space

A gentle AI companion for mental wellness, in **14 languages**. Talk or type, hear a soft voice answer, and calm down with breathing exercises, ambient music, video rooms and mindful mini-games.

> ⚠️ **Mindsence is a wellness companion, not a medical or crisis service.** It is not a substitute for a therapist, doctor, or emergency help. If you or someone you know is in crisis, contact a local helpline or emergency services (India: Tele-MANAS **14416**; US/Canada: **988**; elsewhere: [findahelpline.com](https://findahelpline.com)).

---

## 🚀 Run it (one command, any system)

You need **Python 3.9+**. No Ollama, no model download, no second terminal.

**Windows, easiest:** double-click **`run.bat`**. It sets everything up the first time, installs the free local AI (Ollama) with a model that fits your computer, starts the server and opens your browser.

```bash
git clone https://github.com/PruthviHG/Mental-Health.git
cd Mental-Health
pip install -r requirements.txt        # 3 small packages
python app.py                          # then open http://localhost:5000
```

That's it: the server serves the page **and** the API. Works the same on Windows, macOS and Linux (use `python -m venv venv` first if you like).

**Accounts:** the first screen asks you to **sign up or sign in with email + password, or with Google**. Open it, tap *Create account*, done: no e-mail confirmation step. (The crisis **NEED HELP?** button works on that screen too.) Details in [Accounts](#-accounts-sign-in) below.

**No API key, no installs: use the on-device AI.** When no server model is configured, the header shows a green **GET SMARTER AI (1 GB, once)** button. It starts by itself on a fast connection (or click the button) and a small multilingual AI downloads into your browser (once), then runs **privately on your own device**: nothing you write leaves it. While it downloads, Mindsence keeps answering in simple mode, so nobody waits. Next visit it starts by itself from the browser cache, even offline.

- Needs a recent **Chrome, Edge or Brave** (WebGPU) on a laptop or desktop with a normal graphics chip. Not available in every browser or on every phone.
- It is a small model: replies are simpler than Claude's, and weaker in some languages (Indian languages especially). The crisis safety net still runs before it, always.
- **Too slow on your computer?** Use a smaller model: `window.MINDSENCE_CONFIG = { webModel: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" }` (faster, simpler replies). Closing other heavy tabs and using a laptop's graphics chip (not battery saver) also helps a lot.

**Want stronger replies?** Optionally add a key: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY=...` (or `OPENAI_API_KEY=...`), then restart `python app.py`. The header shows `ONLINE · claude-haiku-5-5 ☁`.

**Nothing at all?** It still works in **SIMPLE MODE**, a tiny built-in responder that listens, validates and points to the breathing exercises. The header always says which mode you are in.

**Speed:** nothing is downloaded on first run any more. The styles, fonts and icons are part of the project and are served from your own server (compressed, and cached for a year per version), so the page needs no other website to look right and works offline. See *Project layout* below.

**On-device AI size:** phones and modest laptops (4 GB or less, 4 cores or fewer) get the lighter model (about 350 MB, faster, simpler replies); stronger machines get the 1.5B model (about 1 GB). On a fast connection without data-saver the download now **starts by itself after sign-in**; on slow or metered connections you get the button instead. Set `autoDownload: false` in `MINDSENCE_CONFIG` to always use the button.

**Music:** put your own tracks in `assets/music/` and they are used first (works offline, no GitHub limits). Otherwise the GitHub list is used, cached for a day. There is a volume slider (remembered) in the music widget and in Rooms, and media keys work. Rooms videos now stream instead of all being downloaded when you open the gallery, which used to starve the music.

**Free local AI (Ollama), recommended for real conversations:** `python tools/setup_ai.py` (run.bat does it every start; it only does what is missing). It first looks at what is **already installed**: if Ollama and a suitable chat model are there, it uses the best one that fits your memory and downloads nothing (embedding models are ignored; a model whose file is more than 60% of your memory is skipped). Only if nothing suitable exists does it install Ollama (on Windows: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for that window only, then `irm https://ollama.com/install.ps1 | iex`), start it, and download **one model sized to your memory**. Finally it checks that the model really answers. Ranking of downloaded models: `qwen2.5:3b`, `llama3.2:3b`, `qwen2.5:1.5b`, `llama3.2:1b`, `gemma2:2b`, `qwen2.5:0.5b`, then any other chat model (bigger first).

| Memory | Model | Download |
|---|---|---|
| 8 GB or more | `qwen2.5:3b` | 1.9 GB |
| 4 to 8 GB | `qwen2.5:1.5b` | 1.0 GB |
| under 4 GB | `qwen2.5:0.5b` | 0.4 GB |

Mindsence then finds it by itself (header: `ONLINE · qwen2.5:3b`), picks the best chat model you have installed, and loads it into memory at start so the first reply is not slow. No graphics card is needed (a CPU is fine, just slower); everything stays on your computer. `python tools/setup_ai.py --check` only reports what is installed and what it would do; `--model name` forces a model; `MINDSENCE_SKIP_AI=1` skips it. macOS/Linux: install Ollama from ollama.com/download first, then run the script. If Ollama is running but no chat model is installed, the header honestly says SIMPLE MODE.

**Other ways to run it**
| Way | How |
|---|---|
| Docker | `docker build -t mindsence . && docker run -p 5000:5000 -v mindsence-data:/data -e ANTHROPIC_API_KEY=... mindsence` (the volume keeps accounts) |
| Hosting (Render, Railway, Fly, ...) | Start command `gunicorn -k gthread --threads 8 -b 0.0.0.0:$PORT app:app`, set the key as an environment variable. `PORT` is detected automatically. |
| Fully local model | Install [Ollama](https://ollama.com) *only if you want to*; if it is running, Mindsence finds it automatically (`MINDSENCE_LLM_PROVIDER=ollama`). |
| Any OpenAI-compatible server | LM Studio, vLLM, llama.cpp server, etc.: set `MINDSENCE_LLM_BASE_URL`. |

> The Dockerfile has not been built in CI yet; the rest of this setup is covered by tests.

---

## 👤 Accounts (sign in)

Everything except the page itself needs a signed-in account.

| | |
|---|---|
| **Email + password** | Works out of the box. Passwords are hashed with scrypt, 8 to 128 characters, common ones refused. Five wrong tries lock that address for 15 minutes. |
| **Google** | Set `GOOGLE_CLIENT_ID` and the *Continue with Google* button appears; without it the button is simply not shown. |
| **Forgot password** | Without SMTP the reset link is **printed in the server console** (fine on your own machine). For real users set `MINDSENCE_SMTP_*` and `MINDSENCE_PUBLIC_URL`. |
| **Session** | A random id in an HttpOnly, SameSite=Lax cookie (30 days, sliding). Only a hash is stored. Signing out also wipes the conversation from the screen. |

**Google setup (5 minutes):** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client ID* → *Web application* → add your address (for example `http://localhost:5000` and your real https domain) under **Authorized JavaScript origins** → copy the client id into `.env` as `GOOGLE_CLIENT_ID=...` and restart. The server verifies Google's signed token itself (signature, audience, issuer, expiry, verified email).

**Good to know**
- Accounts live in `mindsence.db` (SQLite) next to `app.py`. On Render/Railway/Fly etc. the disk is **ephemeral** unless you attach a volume and set `MINDSENCE_DB` to a path on it, or everyone is signed out on each deploy.
- Only email, an optional name and the password hash are stored. **Chat text is never stored** by the server.
- There is **no email-address confirmation** for password sign-ups and **no "delete my account" button** yet. If someone signs in with Google using an address that already has an unconfirmed password account, the password is removed (so nobody can squat on another person's email).
- Login needs the page and the API on the **same address** (the default). Opening `index.html` from disk, or hosting the page separately, will not work.
- Run **one** server process (gunicorn `--workers 1`, as in the Dockerfile): login limits are kept in memory.
- Error messages on the sign-in screen are English only; labels are in all 14 languages.

---

## 🌍 Languages

English · हिन्दी · ಕನ್ನಡ · தமிழ் · తెలుగు · বাংলা · मराठी · Español · Français · Deutsch · Português · العربية (right-to-left) · 中文 · 日本語

- **Auto mode (default):** write in any of these, including Hinglish, and Mindsence answers in the **same language and script**. If you switch language, it switches too.
- **Language picker** in the header fixes the language for the interface, voice, and speech recognition.
- **Voice in your language:** a calm neural voice per language (edge-tts); if the server voice is unavailable, the browser's built-in voice takes over, so speech also works offline.
- **Speech recognition** uses the matching locale (hi-IN, kn-IN, ...) in Chrome/Edge.
- **Safety in every language:** crisis detection, the crisis message, the greeting, check-ins and the help screen exist in all 14 languages and **never depend on the AI model**.

> ⚠️ **Please have a native speaker review the crisis and help text** for each language (`js/i18n/locales.js`, `js/i18n/locales2.js`) before you release this to the public. Helpline numbers should also be re-verified periodically (`js/chat/safety.js`).

Games, room names and some small labels are still English.

---

## ✨ Features

| Area | What it does |
|---|---|
| **Chat companion** | Streaming conversation with memory (rolling window), from a cloud model, a local model, or a private on-device AI, warm texting-style replies that mirror your message length. |
| **Crisis safety net** | Messages that suggest self-harm or suicide (direct *and* indirect wording, 14 languages) **never reach the AI**. A fixed, caring message with tap-to-call helplines appears, a no-jokes "care mode" follows, and **NEED HELP?** is always in the header. |
| **Voice chat** | Tap the mic, talk, and the AI answers aloud. Speaking over it interrupts it. |
| **Voice emotion (optional)** | If you install the extras, your voice tone gently shapes the reply, and the detected emotion (e.g. "VOICE: SAD 80%") shows briefly next to **About · Team** in the footer. Off by default. |
| **Gentle check-ins** | After 5 minutes of silence: a short, no-pressure message (never guilt-inducing). |
| **Rooms, music, 3D background** | Calming video rooms, ambient tracks, and the original three.js particle cloud (100 000 points, 20 000 on phones; start scattered everywhere, gather into a sphere, swell with the music; a steady beat while a YouTube song plays because YouTube's player cannot be analysed). three.js r128 (MIT) is served from `assets/vendor/`, cached for a year. |
| **Games hub** | 11 mini-games including **Box Breathing** and **Desk Yoga**. |
| **Export log / Feedback** | Download the conversation; send feedback (stored locally). |

---

## Project layout

```
app.py auth.py llm_providers.py mailer.py prompts.py   backend (Flask)
index.html  performance.html                           the two pages
style.css                                              original styles (layout, games, rooms)
assets/css/tailwind.css                                Tailwind, built once (npm run build:css), 21 KB
assets/css/icons.css                                   the 14 icons used (npm run build:icons), 8 KB
assets/vendor/fonts/                                   Inter (variable) + JetBrains Mono, self-hosted
js/core/      config, core state, nav, sound, accounts (auth)
js/i18n/      14 language packs, language detection, translated stories
js/chat/      chat flow, AI providers, on-device AI, offline replies, crisis safety, companion, stories
js/voice/     speech in/out, music player
js/features/  games, Block Blast, rooms, feedback, About
js/ui/        background scene (2D canvas), small motion touches
js/perf/      Performance page script and its generated data
tools/        benchmarks, icon + CSS builders, setup helpers
tests/        pytest (backend), node --test (frontend), e2e_smoke.py (browser)
```

**Speed measures:** scripts are `defer`red; first-party files are linked as `file?v=<hash>` and cached for a year (a changed file gets a new hash, so nobody sees stale code); responses are Brotli/gzip-compressed (`pip install brotli` for Brotli); the background scene is a 2D canvas that pauses when the tab is hidden and draws at half rate while the AI is writing.

## 🏗️ Architecture

```
Browser (index.html + js/<group>/)                   Flask backend (app.py)
  chat, voice, rooms, games      ── /chat ──▶   builds the prompt, streams the reply from
  language + crisis safety                       Claude / OpenAI-compatible / Ollama
  simple mode (offline)           ── /tts  ──▶   edge-tts voice per language   (browser voice if it fails)
                                  ── /analyze-emotion ──▶ optional Wav2Vec2
                                  ── /health, /feedback, and the static files
```

The **system prompt lives on the server** and the API key never reaches the browser, so `/chat` can't be used as a free general-purpose LLM proxy. It is also rate-limited per visitor (`MINDSENCE_CHAT_RATE_LIMIT`, default 30/min).

### Backend API

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/` , `/style.css`, `/js/*.js`, `/assets/*` | GET | | the web app (nothing else on disk is served) |
| `/health` | GET | | `{ status, llm: {...}, auth: {required, google}, emotion_available, ... }` (public, no secrets) |
| `/auth/signup`, `/auth/login` | POST | `{ email, password }` | `{ user }` + session cookie |
| `/auth/google` | POST | `{ credential }` (Google ID token) | `{ user }` + session cookie |
| `/auth/me`, `/auth/config` | GET | | `{ user \| null }`, `{ google_client_id, reset_mode }` |
| `/auth/logout`, `/auth/forgot`, `/auth/reset` | POST | | sign out, request / use a reset link |
| `/chat` 🔒 | POST | `{ messages: [{role, content}], context: {lang, crisis, emotion, time}, maxTokens }` | streamed `text/plain` (UTF-8) |
| `/tts` 🔒 | POST | `{ text, lang }` (max 1000 chars) | `audio/mpeg` |
| `/analyze-emotion` 🔒 | POST | multipart `audio` | `{ emotion, confidence, scores }` (501 if the extras aren't installed) |
| `/feedback` 🔒 | POST | `{ email, text }` | appends to `feedback_log.jsonl` |

---

## ⚙️ Configuration

Environment variables or a `.env` file next to `app.py` (see `.env.example`).

| Setting | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | use Claude |
| `OPENAI_API_KEY`, `MINDSENCE_LLM_BASE_URL` | – | use OpenAI or any compatible service |
| `MINDSENCE_LLM_PROVIDER` | `auto` | `auto` · `anthropic` · `openai` · `ollama` · `none` |
| `MINDSENCE_LLM_MODEL` | `claude-haiku-5-5` / `gpt-4o-mini` / `llama3.2:3b` | |
| `MINDSENCE_CHAT_RATE_LIMIT` | `30` | chat requests per minute per signed-in user |
| `GOOGLE_CLIENT_ID` | – | turns on *Continue with Google* |
| `MINDSENCE_DB` | `mindsence.db` | where accounts are stored |
| `MINDSENCE_PUBLIC_URL`, `MINDSENCE_COOKIE_SECURE` | – | your https address (reset e-mails, secure cookie) |
| `MINDSENCE_SMTP_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_FROM` | – | send password-reset e-mails |
| `MINDSENCE_HOST` / `MINDSENCE_PORT` (`PORT`) | `127.0.0.1` / `5000` | host `0.0.0.0` to expose it |
| `MINDSENCE_TTS_VOICE`, `_RATE`, `_PITCH` | `en-GB-SoniaNeural`, `-20%`, `-10Hz` | English voice; other languages have built-in voices |

Frontend settings live in `js/core/config.js` and can be overridden before the scripts load: `window.MINDSENCE_CONFIG = { backendUrl: "...", language: "hi" }`.

**Optional voice emotion:** `pip install -r requirements-emotion.txt` (about 2 GB, includes PyTorch). Skip it unless you want it.

---

## 🔒 Privacy (what changed, honestly)

Earlier versions ran the AI fully on your machine. Using a cloud model is what makes Mindsence easy to run anywhere, but it changes where your words go:

| Mode | Where chat text goes |
|---|---|
| Claude / OpenAI / other cloud API | to that provider, via **your** server (the key stays on the server) |
| Ollama or another local server | stays on your machine |
| **On-device AI** (WebLLM) | stays on your device, fully private |
| Simple mode | stays in the browser |
| Crisis messages | **never** sent to any model, in any mode |

Also: `edge-tts` sends AI replies to Microsoft to synthesize speech (the browser voice fallback does not), and Chrome's speech recognition may use Google's servers. Conversation memory lives only in the browser tab (accounts store your email, never your messages). Feedback is stored in `feedback_log.jsonl` on the server. If you host this publicly, tell your users which provider you use and have a privacy notice.

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| Header says `SIMPLE MODE` | No model is connected. Run `python tools/setup_ai.py` (or `run.bat`), or click **GET SMARTER AI** (needs WebGPU), or add a key to `.env`, then restart. On another device, that device needs its own setup, or open the first computer's address if it was started with `MINDSENCE_HOST=0.0.0.0`. |
| No **GET SMARTER AI** button | Your browser has no WebGPU. Use a recent Chrome/Edge/Brave on desktop, or add an API key. |
| Download stuck or fails | Check the connection and free disk space (about 1 GB), then reload. Set `webModel` in `MINDSENCE_CONFIG` to try a different model. |
| Replies suddenly become basic | The provider rejected the request (bad key, quota, outage). The terminal log says why. |
| No voice / mic does nothing | Use `http://localhost`, Chrome or Edge, and allow the microphone. |
| AI voice sounds like the browser's | The server voice was unreachable (offline); the browser voice is the fallback. |
| Music silent or skipping | A track that cannot load is skipped; if all fail the player says *MUSIC UNAVAILABLE*. For the most reliable music, drop your own `.mp3`/`.ogg`/`.wav`/`.m4a` files into `assets/music/` (no internet needed). |
| Rooms or music empty | They are fetched from the GitHub API, which rate-limits anonymous use. Wait and refresh. |
| "Can't reach the server" on the sign-in screen | Start `python app.py` and open the address it prints. The page and the API must share one address. |
| Google button missing | `GOOGLE_CLIENT_ID` is not set, or the page address is not in the client's *Authorized JavaScript origins*, or `accounts.google.com` is blocked. Email sign-in still works. |
| Everyone signed out after a deploy | Accounts are on an ephemeral disk; mount a volume and set `MINDSENCE_DB`. |
| Page opened from another port | Set `window.MINDSENCE_CONFIG = { backendUrl: "http://127.0.0.1:5000" }`. |

---

## 🧪 Testing

```bash
pip install -r requirements-dev.txt && pytest -q     # backend: chat, providers, voices, static files, safety of paths
npm install && npm test                              # frontend: crisis detection (14 languages), language, chat flow, file hygiene
python tests/e2e_smoke.py                            # real-browser check (needs: pip install playwright && playwright install chromium)
# accounts tests: sign-up/login, lockout, CSRF, forged cookies, forged Google tokens, reset links: tests/test_auth.py
```

CI runs both on every push.

## 🛡️ Safety design

- Crisis detection (`js/chat/safety.js`) runs **before** any model, in all supported languages, with text normalisation for spelling variants. It is deliberately broad: a false alarm costs one caring message.
- The system prompt forbids joking about self-harm, diagnosing, or discouraging human support, and the app repeatedly says it is an AI, not therapy.
- This is a safety net, not a clinical tool. Keyword matching can still miss indirect or unusual wording, especially in languages with many dialects. Treat the test phrases as a starting point and extend them with local speakers.

## 🗺️ Roadmap

- [ ] Native-speaker review of crisis text for all languages
- [ ] A softer "check-in" tier for hopelessness wording (ask directly, don't alarm)
- [ ] Grounding toolkit (5-4-3-2-1, body scan), safety-plan card, mood journal
- [ ] Local, offline voice (e.g. Piper) so no text leaves the device
- [ ] Self-host the room videos and music instead of using the GitHub API

## 🤝 Contributing

Issues and pull requests are welcome. Fork the repo, create a feature branch, and open a PR describing what you changed.

## 🙏 Credits

- [Anthropic Claude](https://www.anthropic.com), [Ollama](https://ollama.com/) and Meta's Llama 3.2 (optional)
- [`ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition`](https://huggingface.co/ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition)
- [edge-tts](https://github.com/rany2/edge-tts), [Tailwind CSS](https://tailwindcss.com/) (built into a static file), [Font Awesome Free](https://fontawesome.com/license/free) icons (CC BY 4.0, 14 of them inlined), [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL OFL, self-hosted)
- Design: the neon look is the original `style.css`; the code structure and performance work follow ideas from [unslop](https://github.com/heydamir/unslop) by heydamir (CC BY 4.0) and [React Bits](https://reactbits.dev) (written fresh, no React Bits code is included)
- Ambient audio from Pixabay; room videos and images from their respective creators

## 👤 Author

Built by **Pruthvi H G** — [@PruthviHG](https://github.com/PruthviHG)

---

*Be kind to yourself. 🤍*

## Voice speed

- Spoken input is sent the moment the browser's recognizer finalizes (no waiting for emotion analysis, which now runs in the background and shapes the *next* reply). Live captions appear while you talk.
- Replies start speaking after the first clause (~24+ chars at a comma), later chunks at sentence ends.
- Audio is decoded ahead, silence-trimmed and scheduled gaplessly with Web Audio; falls back to an `<audio>` element if unavailable.

## Hard moments: real stories and videos

When someone is in crisis, Mindsence first shows the helplines, then a calm card with one real story (Virat Kohli, Sylvester Stallone, N. R. Narayana Murthy, Yash, Steve Jobs, Adele, A. P. J. Abdul Kalam) and three gentle videos. When someone is clearly struggling but not in crisis, a smaller card appears at most a few times, never on every message. The companion also speaks like a steady older sibling, validates first, and never claims a human life of its own. Videos open on YouTube in a new tab; edit `js/chat/stories.js` to change stories or videos.

## E-mail

**Feedback** is sent from inside the app with no setup and no terminal questions (it uses a small relay service; the very first message makes the relay send the inbox owner a one-time activation e-mail, which must be clicked once). Feedback is also always saved to `feedback_log.jsonl`.

**Password-reset links** need a real mail account. Optional: put `GMAIL_ADDRESS` and a Gmail *app password* (Google Account → Security → 2-Step Verification → App passwords) in `.env`, or run `python tools/setup_mail.py`. Without it, reset links are printed in the server window. When Gmail is set, feedback is sent through it instead of the relay.

## Games

All games now run at the same speed on 60, 120 and 144 Hz screens, Retry starts clean, Snake has its own head and a turn queue (and swipe on phones), arrow keys no longer scroll the page, and Zen Hike can be walked by dragging on touch screens.

## Companion, music, colours, sounds

- After sign-in and a full page load, Mindsence says hello out loud and asks your name and how you are. After the first exchange it asks what songs you like and plays them: electronic, melodic, dubstep, trap and drum & bass come from the official NoCopyrightSounds (NCS) YouTube playlists through YouTube's own player (credit shown; NCS's usage policy covers creator videos, so no audio is copied); calm, lo-fi and instrumental use the app's own relaxing tracks.
- After 3-4 messages it asks your favourite colour and shifts the site towards it in three steps over the next messages (the 3D sphere is left untouched). It is remembered on this device.
- None of these questions appear during a hard moment.
- The voice engine itself speaks a little faster (up to +18%) when sentences are waiting, so voice and text finish closer together and the pitch stays natural. Default voice speed is +4% (`MINDSENCE_TTS_RATE`).
- Ask any time: "play some trap music", "stop the music", "make it green", "reset the colour". The player panel has music chips and there is a 🎨 Colour button under the chat box.
- Press **Space** (when not typing, or in an empty message box) or **Alt+V** to talk; press again to stop.
- Open About with the ABOUT button in the top bar or the ⓘ link under the chat box.
- Soft click, typing and message sounds work everywhere, with a speaker button under the chat box to turn them off.
- Back closes the game, room or dialog you are in; on the plain chat screen it asks you to press Back again before leaving.
- About · Team (under the chat box): edit `ABOUT` in `js/features/about.js` to change names or fill in the project coordinator.

## Languages

All 14 languages (English, Hindi, Kannada, Tamil, Telugu, Bengali, Marathi, Spanish, French, German, Portuguese, Arabic, Chinese, Japanese) cover the whole interface: sign-in and its error messages, header, About, feedback box, music and colour controls, the Back hint, the greeting and the companion's questions. Arabic switches the page to right-to-left. Pick a language from the selector, or leave it on Auto and it follows what you write.

- Strings live in `js/locales*.js` (`locales4.js` has the About / feedback / music / colour / sign-in-error text). A missing key falls back to English.
- Music and colour requests, "stop the music", "next song" and "back to the original colour" are understood in every language.
- Support stories: Hindi and Kannada have every story (`js/i18n/stories_i18n.js`). The other languages have the gentle "you matter" message; stories that are not translated are never shown in English inside another language. Video titles stay as published.
- Add a language string by adding the key to every language in `locales4.js` (`tests/locales4.test.js` checks all 14 are complete).

## Performance page

Open **📊 Performance** (below the chat box, same tab; its Back button returns to the chat) or `/performance`. It is a dashboard: KPI cards and gauges, a **live analyzer** (type a message and watch the real safety check, language detection and routing run in your browser), a **critical-situations** test that runs live, accuracy heat-map, speed and size charts and a feature comparison with other kinds of products. Motion uses [anime.js](https://animejs.com/) loaded from a CDN (pinned 4.0.2); if it cannot load, the page animates with plain CSS and works the same. Regenerate it after any change:

```
node tools/benchmark.js                 # accuracy, speed, size -> js/perf/perf_data.js
python tools/benchmark_browser.py       # first-visit and repeat-visit load, crisis screen, reply timings (needs playwright)
node tools/benchmark.js                 # merge the browser results
```

Test sentences are in `tools/bench_data.js`. The page deliberately shows the first-look result on fresh wording (25% of crisis messages caught before the fixes) next to the post-fix score, and says plainly that no other product was benchmarked.

## Voices: Fish Audio + Microsoft, with automatic fallback

Spoken replies use [Fish Audio](https://fish.audio) for the languages it is set up for, and the Microsoft neural voice for the rest. Nothing is required: without a key everything speaks with the Microsoft voices as before.

1. Create a key on fish.audio and put it in `.env` as `FISH_API_KEY=...` (see `.env.example`). It stays on the server: it is never sent to the browser, logged, or shown by `/health`. **If a key was ever pasted into a chat, email or screenshot, delete it on fish.audio and make a new one.**
2. Voices: English uses *Sarah* (soft, breathy, gentle, sincere) and Japanese uses *Calm Woman* (calm, warm, gentle). Other languages use Sarah unless you set `MINDSENCE_FISH_VOICE_<LANG>=<voice id>` (the id is the part after `fish.audio/m/`). Two library voices were left out on purpose: *Hannah* is an advertising voice, and *Ada Wong* is a video-game character's voice.
3. Languages: `MINDSENCE_FISH_LANGS` defaults to `en,ja,zh,es,fr,de,pt,ar`. The six Indian languages (Hindi, Kannada, Tamil, Telugu, Bengali, Marathi) stay on Microsoft voices made for them, because Fish Audio does not publish its language list and I could not listen to it in those languages. To decide for yourself run `python tools/voice_check.py`: it makes one sample per language with both engines and a page to play them side by side. Then set `MINDSENCE_FISH_LANGS=all` (or a list).
4. Fallback chain: Fish Audio -> Microsoft voice -> your browser's own voice. If Fish Audio rejects the key, runs out of credit or is busy, it is skipped for a few minutes so no sentence is delayed.
5. Model: `MINDSENCE_FISH_MODEL=s2.1-pro-free` (free until 2026-11-30 per Fish Audio, no uptime promise, and Fish Audio says free-tier requests may be used to improve its models, so think about that before sending private conversations). Set `s3-pro` or `s2.1-pro` if you pay.

Speech-to-text is unchanged (your browser's built-in recognition): Fish Audio's transcription is a paid, file-based service.

## Play any song

Say or type **"play Shape of You"**, **"ಕೇಸರಿಯಾ ಹಾಡು ಹಾಕಿ"**, **"तुम ही हो गाना चलाओ"**, "play Believer by Imagine Dragons" (any language), or use the song box in the music panel. Mindsence searches YouTube and plays the result in YouTube's own player (so artists are credited and paid). "next song" or ⏭ moves to the next result; a video that cannot be embedded is skipped automatically.

- **No setup needed:** without a key the server reads YouTube's public search page. **Optional but more reliable:** create a YouTube Data API key (console.cloud.google.com → new project → enable *YouTube Data API v3* → Credentials → API key) and put `YOUTUBE_API_KEY=...` in `.env`. Searches are cached and rate-limited (`MINDSENCE_SONG_RATE_LIMIT`, default 20/min per visitor).
- **Without a key** Mindsence still understands the request and gives a one-tap link that opens the search on YouTube.
- Music *styles* ("play dubstep", "play some music") still use the NCS playlists and need no key.

## Talking by voice: who has priority

- **You always come first.** If you speak while Mindsence is talking, its voice and its reply stop at once and your words are used.
- **It does not listen to itself.** While Mindsence speaks, anything the microphone hears that matches what is being said is ignored, and listening carries on. Short words such as "stop" or "wait" are always treated as you. The browser's echo cancellation is also switched on. Headphones work best; with loud speakers a very close match can still slip through.
- **No repeated replies.** Offline replies are never the same twice in a row (openers and questions are combined, in all 14 languages), and the AI is told not to reuse earlier wording. Crisis messages always keep the full helplines.


## Chat commands and photos

Typed or spoken requests that match a command are carried out at once (plain rule matching, not mood analysis). Examples:
"change the color to pink", "volume down a bit", "volume to 30%", "mute", "change the song", "previous song", "pause", "bigger text",
"stop the particles" / "particles faster", "change the colour according to the vibe" (colour follows the song or mood; "stop changing the colour" ends it), "songs like this" (keeps the song and queues similar ones), "open games", "stop talking" / "turn on your voice", "speak in Hindi".
The command words are English plus a few Hindi, Spanish, French, German and Portuguese volume words; confirmations are in English.
Everything else is normal conversation. The rules live in `js/chat/commands.js` (`parseCommand` is covered by `tests/commands.test.js`).

Photos: the image button next to the microphone (or paste / drag a picture) attaches one photo to the next message. It is shrunk in the
browser, sent once and not stored. Models that can see pictures (Claude, GPT-4o and later, Gemini, LLaVA and similar, matched by model name)
receive it; with any other model Mindsence says honestly that it cannot see the picture.

Replies never repeat: the server tells the model what it said recently and notices repeated input, and the browser replaces any reply that
starts like a recent one before it is shown or spoken.

Speech speed: if Fish Audio takes longer than `MINDSENCE_FISH_MAX_SECONDS` (default 1.6) per sentence twice in a row, it is switched off for ten
minutes and the faster Microsoft voice is used.

Spoken or video requests such as "play a motivation video" search for speeches and talks (1 to 40 minutes), not songs. If the AI model ever
answers a request for something the app cannot do, it is told never to claim it will "pass it to the app team" or promise features.
