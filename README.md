<div align="center">

# 🧠 Mindsense

**A person with good mental health can deal with anything.**

An AI-powered mental wellness companion with voice chat, immersive environments, and a built-in arcade — all in your browser.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://pruthvihg.github.io/Mental-Health/)
[![HTML](https://img.shields.io/badge/HTML-66%25-orange?style=flat-square&logo=html5)](.)
[![JavaScript](https://img.shields.io/badge/JavaScript-28%25-yellow?style=flat-square&logo=javascript)](.)
[![CSS](https://img.shields.io/badge/CSS-5%25-blue?style=flat-square&logo=css3)](.)

</div>

---

## ✨ What is Mindsense?

Mindsense is a browser-based mental health support app that combines an empathetic AI chatbot with voice interaction, immersive visual environments, and stress-relief mini-games. No sign-up, no downloads — just open and talk.

---

## 🚀 Features

### 🤖 AI Chat Companion
- Real-time conversational AI streamed via WebSocket
- Empathetic responses designed for emotional support
- Text or voice input — your choice

### 🎙️ Live Voice Mode
- Speech recognition via the Web Speech API — just click the mic and talk
- AI responses spoken aloud using the ElevenLabs TTS API
- Three.js particle system reacts and pulses to audio frequencies in real time

### 🌍 Immersive Rooms
Switch between calming visual environments with dynamic animations:
- 🌧️ Rain room
- 🌌 Space room
- 🌲 Nature / forest room
- 🌑 Dark / night room
- Each room has unique firefly animations and ambient video backgrounds

### 🎮 Arcade (10 Mini-Games)
Stress relief through play — a collection of browser games designed to distract and delight:
- Neon Surge, Quantum Snake, and 8 more
- Accessible from the main chat interface via the Games button

### 🎵 Ambient Music
- Background music crossfades between tracks
- Music library hosted and streamed from GitHub

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| 3D Background | [Three.js](https://threejs.org/) |
| Voice Input | Web Speech API |
| Text-to-Speech | [ElevenLabs API](https://elevenlabs.io/) |
| AI Backend | WebSocket — `wss://backend.buildpicoapps.com` |
| Deployment | GitHub Pages |

---

## 📁 Project Structure

```
Mental-Health/
├── final/                  ← Latest version (active)
│   ├── index.html          Main app UI
│   ├── script.js           Core logic — chat, TTS, voice, games, rooms
│   └── style.css           All styles
├── Mindsense/              Earlier version
├── assets/                 Video backgrounds and room media
│   ├── dark.mp4
│   ├── tree.mp4
│   ├── anime/
│   ├── nature/
│   ├── rain/
│   └── space/
├── With voice.html         Voice prototype
├── sample.html             UI prototype
├── voice chatbot.html      Chatbot prototype
└── README.md
```

---

## ⚡ Getting Started

No build step, no installs. Just:

1. Clone the repo
   ```bash
   git clone https://github.com/PruthviHG/Mental-Health.git
   ```

2. Open `final/index.html` in a modern browser (Chrome or Edge recommended)

3. Allow microphone access when prompted

4. Start typing — or click the mic to talk

> The app requires an internet connection for the AI backend, ElevenLabs TTS, and music streaming.

---

## 🌐 Live Demo

👉 [pruthvihg.github.io/Mental-Health](https://pruthvihg.github.io/Mental-Health/)

---

## ⚠️ Disclaimer

Mindsense is a wellness support tool, not a substitute for professional mental health care. If you or someone you know is in crisis, please reach out to a licensed professional or a crisis helpline in your region.

---

## 👤 Author

**PruthviHG**
- GitHub: [@PruthviHG](https://github.com/PruthviHG)

---

<div align="center">
Made with ❤️ for better mental health
</div>
