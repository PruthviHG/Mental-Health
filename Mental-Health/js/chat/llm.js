// ==========================================
// --- LLM LAYER (talks to the backend /chat; falls back to built-in simple mode) ---
// The browser never holds an API key and never builds the system prompt: it sends the conversation plus a
// few small context fields (language, care mode, voice tone) to /chat. The backend picks the model
// (Claude, any OpenAI-compatible API, or Ollama). If no model is reachable, simple mode (js/chat/simple.js)
// keeps the app useful instead of showing an error to someone who may be struggling.
// ==========================================

const chatHistory = [];          // [{ role: "user" | "assistant", content }]
let crisisTurnsLeft = 0;
let serviceMode = "unknown";     // "model" | "simple" | "unknown"
let simpleNoteShown = false;

function inCrisisMode() { return crisisTurnsLeft > 0; }

function trimHistory() {
    while (chatHistory.length > MINDSENCE.maxHistoryMessages) chatHistory.shift();
    while (chatHistory.length && chatHistory[0].role !== "user") chatHistory.shift();
}
function rememberUser(text) { chatHistory.push({ role: "user", content: text }); trimHistory(); }
function rememberAssistant(text) { if (text && text.trim()) { chatHistory.push({ role: "assistant", content: text.trim() }); trimHistory(); } }
function resetConversation() { chatHistory.length = 0; crisisTurnsLeft = 0; simpleNoteShown = false; if (typeof resetSupport === 'function') resetSupport(); }

// Small, whitelisted context for the server-built system prompt.
function buildChatContext() {
    const ctx = { lang: (typeof convLang !== "undefined" ? convLang : "en"), crisis: inCrisisMode(), time: new Date().toLocaleString() };
    const emo = (typeof getFreshEmotion === "function") ? getFreshEmotion() : null;
    if (emo) ctx.emotion = { label: emo.label, confidence: emo.confidence };
    if (typeof companion !== "undefined" && companion.name) ctx.name = companion.name;
    return ctx;
}

// Hide [vocal cues], *actions* and a half-streamed "[si" at the end of the text.
function displayText(raw) {
    return raw
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\[[^\]]*$/, "")
        .replace(/\*[^*]*\*/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

// No model reachable: answer with the built-in responder, typed out gently like a real reply.
async function simpleModeReply({ signal, onText }) {
    serviceMode = "simple";
    if (webllm.state !== "loading") setStatus("simple");      // keep the download progress visible
    const lastUser = [...chatHistory].reverse().find(m => m.role === "user");
    let text = simpleReply(lastUser ? lastUser.content : "", typeof convLang !== "undefined" ? convLang : "en");
    if (window.imageNotSeen) {                                  // a photo was sent but no model that can see it is connected
        window.imageNotSeen = false;
        text = _fresh(["Thank you for sharing that. I can't view pictures with the model I'm using right now, so tell me what's in it, or how it makes you feel.",
                       "I got your photo, but I can't see images at the moment. What is it of, and what does it mean to you?",
                       "I can't open pictures right now, sadly. Describe it to me in a few words and I'll be right here."], "img-unseen");
    }
    if (!simpleNoteShown) { simpleNoteShown = true; text = `${tc("simple")}\n\n${text}`; }

    let shown = "";
    for (let i = 0; i < text.length; i += 8) {
        if (signal && signal.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
        shown = text.slice(0, i + 8);
        onText(shown);
        await _sleep(12);
    }
    return text;
}

// Streams a reply for the current chatHistory. Calls onText(rawSoFar) as text arrives.
async function requestChatReply({ signal, onText }) {
    // No server model? Use the on-device AI if it has finished loading (private, offline, no key).
    if (webllmReady() && !_serverHasModel()) return onDeviceReply({ signal, onText });

    let response;
    const image = (typeof takeOutgoingImage === "function") ? takeOutgoingImage() : null;
    window.imageNotSeen = !!image;                      // if we fall back to the built-in responder it must say so honestly
    try {
        response = await fetch(CHAT_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({ messages: chatHistory, context: buildChatContext(), maxTokens: MINDSENCE.maxReplyTokens, image })
        });
    } catch (err) {
        if (err.name === "AbortError") throw err;
        return webllmReady() ? onDeviceReply({ signal, onText }) : simpleModeReply({ signal, onText });   // server unreachable
    }
    if (response.status === 401) {                              // signed out or session expired
        if (typeof onUnauthenticated === "function") onUnauthenticated();
        const e = new Error("Please sign in again."); e.name = "AuthError"; throw e;
    }
    if (!response.ok || !response.body) {                       // no model configured / provider down
        return webllmReady() ? onDeviceReply({ signal, onText }) : simpleModeReply({ signal, onText });
    }

    serviceMode = "model";
    setStatus("model");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");               // stream:true keeps multi-byte characters intact across chunks
    let full = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const piece = decoder.decode(value, { stream: true });
        if (piece) { full += piece; onText(full); }
    }
    const tail = decoder.decode();
    if (tail) { full += tail; onText(full); }
    return full;
}

function friendlyLlmError(err) { return err && err.name === "AuthError" ? "Please sign in again." : "Something went wrong. Please try again."; }

// ----- Status badge in the header -----
let healthInfo = null;

function setStatus(kind, detail) {
    const dot = document.getElementById("status-dot"), label = document.getElementById("status-label");
    if (!dot || !label) return;
    // Once the on-device AI is ready, a later "simple" signal (e.g. one failed request) must not hide that.
    if (kind === "simple" && typeof webllmReady === "function" && webllmReady()) kind = "ondevice";
    const simple = kind === "simple";
    dot.style.background = simple ? "#fbbf24" : "";
    dot.style.boxShadow = simple ? "0 0 8px #fbbf24" : "";
    label.classList.remove("hidden", "sm:inline");
    label.classList.add("inline");
    label.textContent = kind === "simple" ? "Simple mode" : kind === "ondevice" ? "On-device AI" : (detail || "Online");
    label.title = simple ? "No AI model is connected: basic replies only"
        : kind === "ondevice" ? "Running privately on this device. Nothing you write leaves it." : "";
}

let _statusRetriesLeft = 5;           // a local model can be slow to answer right after startup: don't get stuck on one miss
async function checkStatus() {
    if (typeof document === "undefined") return;     // page/tab is gone (a stray retry timer should not throw)
    try {
        const res = await fetch(HEALTH_URL);
        if (!res.ok) throw new Error("health " + res.status);
        healthInfo = await res.json();
        if (typeof emotionAvailable !== "undefined") emotionAvailable = healthInfo.emotion_available !== false;
        const llm = healthInfo.llm || {};
        if (llm.provider === "none") {
            setStatus(webllmReady() ? "ondevice" : "simple"); offerOnDeviceAi();
            if (_statusRetriesLeft > 0) { _statusRetriesLeft--; setTimeout(checkStatus, 10000); }
        } else { _statusRetriesLeft = 0; setStatus("model", `Online · ${String(llm.label || llm.provider || "")}${llm.mode === "cloud" ? " ☁" : ""}`.trim()); }
    } catch (e) {
        if (typeof emotionAvailable !== "undefined") emotionAvailable = false;
        setStatus(webllmReady() ? "ondevice" : "simple");
        offerOnDeviceAi();
        if (_statusRetriesLeft > 0) { _statusRetriesLeft--; setTimeout(checkStatus, 10000); }
    }
}

if (typeof document !== "undefined") checkStatus();
