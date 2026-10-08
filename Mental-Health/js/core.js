// ==========================================
// --- GLOBAL STATE ---
// ==========================================
let isArcadeActive = false;
let isRoomsActive = false;

// ==========================================
// --- INTERRUPTION & LLM CONTROL ---
// ==========================================
let llmAbortController = null;
let ttsAbortController = null;

function stopAI() {
    // 1. Instantly stop any currently playing audio
    if (typeof cancelSpeech === 'function') cancelSpeech();
    unmuteAfterSpeech();
    // 2. Kill the Text Generator (Ollama)
    if (llmAbortController) {
        llmAbortController.abort();
        llmAbortController = null;
    }
    // 3. Kill the Audio Generator (Edge-TTS Fetch)
    if (ttsAbortController) {
        ttsAbortController.abort();
        ttsAbortController = null;
    }
    receiving = false;
    sendButton.disabled = false;
    const thinkingIndicators = document.querySelectorAll('#chatbox .animate-pulse, .mime-popup .animate-pulse');
    thinkingIndicators.forEach(el => el.remove());
}

