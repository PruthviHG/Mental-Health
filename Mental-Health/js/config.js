// ==========================================
// --- CONFIG (single source of truth) ---
// Override any value BEFORE the scripts load, e.g. in index.html:
//   <script>window.MINDSENCE_CONFIG = { model: "mistral:7b" };</script>
// ==========================================
const _userCfg = (typeof window !== "undefined" && window.MINDSENCE_CONFIG) || {};

const MINDSENCE = Object.freeze(Object.assign({
    backendUrl: "http://127.0.0.1:5000",   // Flask: emotion, TTS, feedback
    ollamaUrl: "http://127.0.0.1:11434",   // Ollama server
    model: "llama3.2:3b",                  // any chat-capable Ollama model
    speechLang: "en-US",
    temperature: 0.7,
    topP: 0.9,
    maxReplyTokens: 150,
    maxHistoryMessages: 16,                // rolling window sent to the model
    emotionMaxAgeMs: 30000,                // how long a voice-emotion reading stays relevant
    emotionMinConfidence: 0.4,             // ignore low-confidence readings
    crisisModeTurns: 10                    // gentle "care mode" length after a crisis message
}, _userCfg));

const LOCAL_BACKEND_URL = MINDSENCE.backendUrl;
const EMOTION_API_URL = `${LOCAL_BACKEND_URL}/analyze-emotion`;
const OLLAMA_BASE_URL = MINDSENCE.ollamaUrl;
const OLLAMA_CHAT_URL = `${OLLAMA_BASE_URL}/api/chat`;
const LOCAL_MODEL = MINDSENCE.model;
