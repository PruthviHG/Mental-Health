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
    stopSpeech();   // cancels queued sentences + in-flight TTS requests
    if (!nexusVoicePlayer.paused) {
        nexusVoicePlayer.pause();
        nexusVoicePlayer.currentTime = 0;
        unmuteAfterSpeech();
    }
    // 2. Kill the text generator (the /chat stream)
    if (llmAbortController) {
        llmAbortController.abort();
        llmAbortController = null;
    }
    // 3. Kill the Audio Generator (TTS fetch)
    if (ttsAbortController) {
        ttsAbortController.abort();
        ttsAbortController = null;
    }
    receiving = false;
    sendButton.disabled = false;
    const thinkingIndicators = document.querySelectorAll('#chatbox .animate-pulse, .mime-popup .animate-pulse');
    thinkingIndicators.forEach(el => el.remove());
}

