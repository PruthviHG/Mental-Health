// ==========================================
// --- CONFIG (single source of truth) ---
// Override any value BEFORE the scripts load, e.g. in index.html:
//   <script>window.MINDSENCE_CONFIG = { backendUrl: "https://my-server.example" };</script>
// ==========================================
const _userCfg = (typeof window !== "undefined" && window.MINDSENCE_CONFIG) || {};
const _sameOrigin = (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol))
    ? window.location.origin : "http://127.0.0.1:5000";   // opened as file:// -> talk to a local backend

const MINDSENCE = Object.freeze(Object.assign({
    backendUrl: _sameOrigin,               // Flask serves the page and the API from the same address
    language: "auto",                      // "auto" or a code from js/i18n.js (en, hi, kn, ta, ...)
    temperature: 0.7,
    maxReplyTokens: 220,                   // the server scales this up for non-Latin scripts
    maxHistoryMessages: 16,                // rolling window sent to the model
    emotionMaxAgeMs: 30000,                // how long a voice-emotion reading stays relevant
    emotionMinConfidence: 0.5,             // ignore low-confidence readings
    crisisModeTurns: 10,                   // gentle "care mode" length after a crisis message
    playlist: null,                        // optional: [{ name, url }, ...] to use your own music instead of the built-in list
    autoDownload: true,                    // start the on-device AI download by itself on a fast, unmetered connection (false = button only)
    onDeviceAi: true,                      // offer the no-key, in-browser AI when no server model is configured
    webModel: "",                          // force a specific WebLLM model id (default: best small multilingual one available)
    webllmLoader: null                     // advanced/tests: async () => webllm module
}, _userCfg));

const LOCAL_BACKEND_URL = MINDSENCE.backendUrl;
const EMOTION_API_URL = `${LOCAL_BACKEND_URL}/analyze-emotion`;
const CHAT_API_URL = `${LOCAL_BACKEND_URL}/chat`;
const HEALTH_URL = `${LOCAL_BACKEND_URL}/health`;
