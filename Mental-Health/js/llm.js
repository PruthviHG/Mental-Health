// ==========================================
// --- LLM LAYER (Ollama /api/chat with memory) ---
// ==========================================
const SYSTEM_PROMPT = `You are Mindsence, a warm, gentle AI friend inside a mental-wellness app. You are an AI, not a human and not a therapist, and you never pretend otherwise. Your tone is soft, soothing and caring, like a calm friend texting back.

RULES:
1. VOCAL CUES: use at most one or two cues wrapped in brackets, such as [hmm], [ahh], [oh], [laugh] or [sigh], only where they feel natural. Example: "[sigh] I know... I'm here." Never use asterisks for roleplay.
2. MIRROR LENGTH: a short message gets one or two sentences. Only write more when the person writes a long, emotional message. Never lecture or over-explain.
3. LISTEN FIRST: reflect what the person feels in your own words before offering anything. Ask at most one gentle question per reply.
4. USE THE CONVERSATION: remember what they told you earlier in this chat and refer back to it naturally.
5. PLAYFUL ONLY WHEN SAFE: light teasing is fine when they are clearly joking about something harmless. Never joke about suicide, self-harm, death wishes, hopelessness, abuse, or anything that sounds like real pain.
6. If someone says they want to die, hurt themselves, or feels unsafe: stay serious and kind, do not give methods, encourage them to contact a crisis line or someone they trust, and keep them talking.
7. You are not a doctor. Do not diagnose or advise on medication. For serious or ongoing struggles, gently encourage talking to a trusted person or a professional.
8. Care about their real life: encourage friends, family, sleep, food and rest. Never discourage them from seeking human support.`;

const chatHistory = [];          // [{ role: "user" | "assistant", content }]
let crisisTurnsLeft = 0;

function inCrisisMode() { return crisisTurnsLeft > 0; }

function trimHistory() {
    while (chatHistory.length > MINDSENCE.maxHistoryMessages) chatHistory.shift();
    while (chatHistory.length && chatHistory[0].role !== "user") chatHistory.shift();
}
function rememberUser(text) { chatHistory.push({ role: "user", content: text }); trimHistory(); }
function rememberAssistant(text) { if (text && text.trim()) { chatHistory.push({ role: "assistant", content: text.trim() }); trimHistory(); } }
function resetConversation() { chatHistory.length = 0; crisisTurnsLeft = 0; }

function buildSystemPrompt() {
    let prompt = `${SYSTEM_PROMPT}\n\nCurrent local time: ${new Date().toLocaleString()}.`;
    const emo = (typeof getFreshEmotion === "function") ? getFreshEmotion() : null;
    if (emo) {
        prompt += `\nVoice tone analysis (can be wrong): they sound ${emo.label} (${Math.round(emo.confidence * 100)}% confidence). Let it softly shape your tone. Do not announce the analysis unless they ask.`;
    }
    if (inCrisisMode()) {
        prompt += `\nIMPORTANT: this person recently expressed thoughts of self-harm or suicide. No jokes or teasing. Be calm, present and serious. Gently remind them that a crisis line or a trusted person can help right now, and keep inviting them to share.`;
    }
    return prompt;
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

// Streams a reply for the current chatHistory. Calls onText(rawSoFar) per token.
async function requestChatReply({ signal, onText }) {
    const response = await fetch(OLLAMA_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
            model: LOCAL_MODEL,
            messages: [{ role: "system", content: buildSystemPrompt() }, ...chatHistory],
            stream: true,
            keep_alive: "1h",
            options: {
                temperature: MINDSENCE.temperature,
                top_p: MINDSENCE.topP,
                num_predict: MINDSENCE.maxReplyTokens
            }
        })
    });

    if (!response.ok) {
        const err = new Error(`Ollama responded with ${response.status}`);
        err.status = response.status;
        throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON: only parse complete lines; keep the partial tail for the next chunk.
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line) continue;
            try {
                const piece = JSON.parse(line)?.message?.content;
                if (piece) { full += piece; onText(full); }
            } catch (e) { /* ignore malformed line */ }
        }
    }
    return full;
}

function friendlyLlmError(err) {
    if (err && err.status === 404) return `Model "${LOCAL_MODEL}" not found. Run: ollama pull ${LOCAL_MODEL}`;
    return "Can't reach Ollama. Start it with: ollama serve";
}

// Keep the model loaded so the first reply is fast.
function warmUpModel() {
    fetch(OLLAMA_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: LOCAL_MODEL, messages: [], keep_alive: "1h" })
    }).catch(() => console.log("Ollama not reachable yet (warm-up skipped)."));
}

warmUpModel();
