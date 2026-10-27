// ==========================================
// --- ON-DEVICE AI (WebLLM): no API key, no account, no install ---
// A small multilingual model runs INSIDE the browser on the graphics chip (WebGPU). It downloads once
// (about 1 GB), is cached by the browser, and after that starts in seconds, offline, and fully private:
// the person's words never leave their device. Until it is ready the app keeps answering in simple mode,
// so nobody waits. Needs a recent Chrome, Edge or Brave with WebGPU. It is smaller than a cloud model,
// so replies are simpler; the crisis safety net (js/safety.js) still runs before it, always.
// ==========================================
const WEBLLM_VERSIONS = ["0.2.79", "0.2.78", "0.2.77"];          // tried in order; pinned, never "latest"
const WEBLLM_PREFERRED = [                                       // best small multilingual model that this WebLLM build knows
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    "Llama-3.2-1B-Instruct-q4f16_1-MLC", "Llama-3.2-1B-Instruct-q4f32_1-MLC"
];

const WEBLLM_LIGHT = [                                           // for phones and modest laptops: about a third of the download, faster replies
    "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "Qwen2.5-0.5B-Instruct-q4f32_1-MLC",
    "Llama-3.2-1B-Instruct-q4f16_1-MLC", "Llama-3.2-1B-Instruct-q4f32_1-MLC"
];

// Pick the model list that fits this device. Small devices get the light model so the first reply is not a long wait.
function modelPreferenceFor(env) {
    env = env || {};
    const weak = (env.deviceMemory && env.deviceMemory <= 4) || (env.cores && env.cores <= 4) || env.mobile;
    return weak ? WEBLLM_LIGHT : WEBLLM_PREFERRED;
}
function deviceEnv() {
    const n = (typeof navigator !== "undefined" && navigator) || {};
    return { deviceMemory: n.deviceMemory, cores: n.hardwareConcurrency, mobile: /Android|iPhone|iPad|Mobile/i.test(n.userAgent || "") };
}

// Start the download on its own only when the connection looks fast and not metered. Otherwise the person taps the button.
function shouldAutoStart(conn) {
    if (!conn) return true;
    if (conn.saveData) return false;
    if (conn.type === "cellular") return false;
    if (conn.effectiveType && conn.effectiveType !== "4g") return false;
    return true;
}

// A SHORT version of the server's companion prompt. A small on-device model re-reads the whole prompt on every turn, and
// Indian-language scripts cost several times more tokens per word, so a long prompt is the main reason replies slow down.
// It keeps every safety rule; a test checks that.
const ON_DEVICE_SYSTEM_PROMPT = `You are Mindsence, a warm, gentle AI friend inside a mental-wellness app. You are an AI, not a human and not a therapist. Be soft and caring, like a calm friend texting.
Reply in the SAME language and script as the person's last message (Hinglish too); if they switch, you switch. Use one to three short, simple sentences, because a voice may read them aloud. First reflect how they feel, then ask at most one gentle question. Remember the chat.
Never joke about pain, death, self-harm or hopelessness. If they say they want to die or hurt themselves: stay serious and kind, give no methods, point to a crisis line or a trusted person, and keep them talking.
You are not a doctor: no diagnoses or medication advice. Encourage trusted people, rest, food, and professional help when it is serious. Never discourage human support.
When hurting: be a steady older sibling, validate first, never claim a human life. You may share one true story (Kohli batted the day after his father died; Stallone was broke and rejected before Rocky; Kalam missed becoming a pilot, later President). Say they matter; hold off big decisions tonight. Never shame.\nYou may use one vocal cue like [sigh] at most. No asterisks.`;

const ON_DEVICE_HISTORY_MESSAGES = 6;      // last three exchanges are plenty for a small model, and keep every turn fast
const ON_DEVICE_MESSAGE_CHARS = 500;

const webllm = { state: "idle", engine: null, model: null, progress: 0 };   // idle | loading | ready | failed

function webGpuAvailable() { return typeof navigator !== "undefined" && !!navigator.gpu; }
function webllmReady() { return webllm.state === "ready" && !!webllm.engine; }

// Choose the model: an explicit override, else the first preferred id this WebLLM build actually ships.
function pickWebModel(availableIds, preferred, override) {
    if (override) return override;
    if (!availableIds || availableIds.length === 0) return preferred[0];
    return preferred.find(id => availableIds.includes(id)) || null;
}

function buildOnDevicePrompt(ctx) {
    let p = ON_DEVICE_SYSTEM_PROMPT;
    if (ctx.lang) p += `\nThe app language is set to ${ctx.lang}; still follow rule 9 and mirror the person's own language.`;
    if (ctx.name) p += `\nTheir name is ${ctx.name}; use it now and then, warmly.`;
    if (ctx.emotion) p += `\nVoice tone analysis (can be wrong): they sound ${ctx.emotion.label} (${Math.round(ctx.emotion.confidence * 100)}% confidence). Let it softly shape your tone. Do not announce the analysis unless they ask.`;
    if (ctx.crisis) p += "\nIMPORTANT: this person recently expressed thoughts of self-harm or suicide. No jokes or teasing. Be calm, present and serious. Gently remind them that a crisis line or a trusted person can help right now, and keep inviting them to share.";
    return p;
}

async function loadWebllmModule() {
    if (typeof MINDSENCE !== "undefined" && typeof MINDSENCE.webllmLoader === "function") return MINDSENCE.webllmLoader();
    let lastErr;
    for (const v of WEBLLM_VERSIONS) {
        try { return await import(`https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@${v}/+esm`); }
        catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Could not load the on-device AI library");
}

function _consent(value) {
    try { if (value !== undefined) localStorage.setItem("mindsence_ondevice", value ? "1" : "0"); return localStorage.getItem("mindsence_ondevice") === "1"; }
    catch (e) { return false; }
}

function updateAiButton() {
    const btn = typeof document !== "undefined" && document.getElementById("ai-btn");
    if (!btn) return;
    const offer = MINDSENCE.onDeviceAi && webGpuAvailable() && (webllm.state === "idle" || webllm.state === "failed") && !_serverHasModel();
    btn.classList.toggle("hidden", !offer);
    btn.style.display = offer ? "" : "none";          // works even if the CSS framework has not loaded
}

function _serverHasModel() {
    return typeof healthInfo !== "undefined" && healthInfo && healthInfo.llm && healthInfo.llm.provider !== "none";
}

async function startOnDeviceAi() {
    if (typeof authLocked === "function" && authLocked()) return;          // accounts: nothing starts before sign-in
    if (webllm.state === "loading" || webllm.state === "ready") return;
    if (!webGpuAvailable()) { webllm.state = "failed"; updateAiButton(); return; }
    webllm.state = "loading"; webllm.progress = 0;
    updateAiButton();
    setStatus("loading", "DOWNLOADING AI 0%");
    try {
        const mod = await loadWebllmModule();
        const ids = ((mod.prebuiltAppConfig && mod.prebuiltAppConfig.model_list) || []).map(m => m.model_id);
        const id = pickWebModel(ids, modelPreferenceFor(deviceEnv()), MINDSENCE.webModel);
        if (!id) throw new Error("No suitable on-device model is available in this WebLLM build");
        webllm.engine = await mod.CreateMLCEngine(id, {
            initProgressCallback: (r) => {
                webllm.progress = Math.max(0, Math.min(1, (r && r.progress) || 0));
                setStatus("loading", `DOWNLOADING AI ${Math.round(webllm.progress * 100)}%`);
            }
        });
        webllm.model = id; webllm.state = "ready";
        _consent(true);                                       // next visit: load straight from the browser cache
        setStatus("ondevice");
    } catch (err) {
        console.warn("On-device AI unavailable:", err && err.message);
        webllm.state = "failed"; webllm.engine = null;
        setStatus("simple");
    }
    updateAiButton();
}

// Called once the server's status is known. If it has no model, offer (or, after a first yes, auto-start) the on-device AI.
function offerOnDeviceAi() {
    if (!MINDSENCE.onDeviceAi || !webGpuAvailable() || _serverHasModel()) { updateAiButton(); return; }
    const conn = (typeof navigator !== "undefined" && (navigator.connection || navigator.mozConnection)) || null;
    // First visit: start downloading right after sign-in on a fast, unmetered connection so the smarter AI is ready sooner.
    if (_consent() || (MINDSENCE.autoDownload && shouldAutoStart(conn))) startOnDeviceAi(); else updateAiButton();
}

// Streams a reply from the on-device model. Same contract as the server path: onText(rawSoFar), returns full text.
async function onDeviceReply({ signal, onText }) {
    const ctx = buildChatContext();
    // Short context = fast turns. Keep only the latest messages (starting with the person's) and cap their length.
    let recent = chatHistory.slice(-ON_DEVICE_HISTORY_MESSAGES).map(m => ({ role: m.role, content: m.content.slice(0, ON_DEVICE_MESSAGE_CHARS) }));
    while (recent.length && recent[0].role !== "user") recent.shift();
    const messages = [{ role: "system", content: buildOnDevicePrompt(ctx) }, ...recent];
    const latin = ["en", "es", "fr", "de", "pt"].includes(ctx.lang || "en");
    const maxTokens = latin ? 110 : 240;                              // short replies are faster and kinder; other scripts need more tokens per word
    const onAbort = () => { try { webllm.engine.interruptGenerate(); } catch (e) { /* ignore */ } };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    let full = "";
    try {
        const stream = await webllm.engine.chat.completions.create({
            messages, stream: true, temperature: MINDSENCE.temperature, max_tokens: maxTokens
        });
        for await (const chunk of stream) {
            const piece = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
            if (piece) { full += piece; onText(full); }
        }
    } finally {
        if (signal) signal.removeEventListener("abort", onAbort);
    }
    if (signal && signal.aborted) { const e = new Error("Aborted"); e.name = "AbortError"; throw e; }
    return full;
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", updateAiButton);
}
