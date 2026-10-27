// ==========================================
// --- REAL-TIME LIVE SPEECH CHAT & EMOTION (LOCAL WAV2VEC2) ---
// ==========================================
let isLiveModeActive = false;
let speechRecognition = null;
let mediaRecorder = null;
let audioChunks = [];
let voiceSent = false;            // the current spoken message has already been sent (never send it twice)

const liveVoiceBtn = document.getElementById("liveVoiceBtn");
const messageInput = document.getElementById("messageInput");


// Latest emotion estimate from the local Wav2Vec2 model:
// { label, confidence (0-1), scores, ts }
let emotionAvailable = true;      // set from /health: the optional emotion model may not be installed
let lastEmotion = null;
let emotionBadgeTimer = null;

function getFreshEmotion() {
    if (!lastEmotion) return null;
    const fresh = Date.now() - lastEmotion.ts <= MINDSENCE.emotionMaxAgeMs;
    return fresh && lastEmotion.confidence >= MINDSENCE.emotionMinConfidence ? lastEmotion : null;
}

function setEmotionBadge(emotion) {
    const badge = document.getElementById('emotion-badge');
    if (!badge) return;
    clearTimeout(emotionBadgeTimer);
    if (!emotion) { badge.classList.add('hidden'); return; }
    badge.textContent = `VOICE: ${emotion.label.toUpperCase()} ${Math.round(emotion.confidence * 100)}%`;
    badge.classList.remove('hidden');
    emotionBadgeTimer = setTimeout(() => badge.classList.add('hidden'), MINDSENCE.emotionMaxAgeMs);
}

async function analyzeAudioEmotion(audioBlob) {
    if (!emotionAvailable) return;
    try {
        const formData = new FormData();
        let upload = audioBlob, name = 'voice.webm';
        try { upload = await blobToWav16k(audioBlob); name = 'voice.wav'; }      // backend can always read WAV
        catch (e) { console.warn("WAV conversion failed, sending original audio:", e.message); }
        formData.append("audio", upload, name);

        const response = await fetch(EMOTION_API_URL, { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok || !result.emotion) throw new Error(result.error || "No emotion returned");

        lastEmotion = {
            label: result.emotion,
            confidence: typeof result.confidence === 'number' ? result.confidence : 0,
            scores: result.scores || {},
            ts: Date.now()
        };
        setEmotionBadge(lastEmotion);
    } catch (error) {
        console.warn("Emotion analysis unavailable:", error.message);
        lastEmotion = null;
        setEmotionBadge(null);
    }
}

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false; 
    speechRecognition.interimResults = true; 
    speechRecognition.lang = (typeof speechLocale === 'function') ? speechLocale(convLang) : 'en-US';

    // Send the moment the recognizer says the sentence is final. Waiting for the microphone to close, the recording to
    // stop and the emotion upload (up to 1.5 s) used to add a noticeable pause before every reply.
    function sendSpokenMessage() {
        if (!isLiveModeActive || voiceSent) return;
        const text = messageInput.value.trim();
        if (!text) return;
        voiceSent = true;
        try { speechRecognition.stop(); } catch (e) { /* already stopped */ }
        document.getElementById("sendButton").click();
    }

    speechRecognition.onstart = async function() {
        voiceSent = false;
        stopAI(); // Interruption trigger
        liveVoiceBtn.innerHTML = '<i class="fas fa-satellite-dish"></i>';
        messageInput.placeholder = t('listen');
        
        muteForSpeech(); 

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                unmuteAfterSpeech(); 
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                sendSpokenMessage();                                   // fallback: a recognizer that never reported a final result
                analyzeAudioEmotion(audioBlob);                        // in the background: it shapes the NEXT reply, never delays this one
            };
            mediaRecorder.start();
        } catch (err) { console.error("Mic access denied:", err); }
    };

    speechRecognition.onresult = function(event) {
        let finalTranscript = '', interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) { messageInput.value = finalTranscript; sendSpokenMessage(); }
        else if (interimTranscript) messageInput.value = interimTranscript;        // live captions while you speak
    };

    speechRecognition.onend = function() {
        liveVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        messageInput.placeholder = t('ph');
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); 
        }
    };
} else { liveVoiceBtn.style.display = 'none'; }

// Shortcut: Space (when not typing a message) or Alt+V anywhere starts/stops live voice. Easy to reach, no mouse needed.
document.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || liveVoiceBtn.style.display === "none") return;
    if (typeof authLocked === "function" && authLocked()) return;
    if (typeof isArcadeActive !== "undefined" && (isArcadeActive || isRoomsActive)) return;
    if (document.querySelector("#help-modal:not(.hidden), #about-modal:not(.hidden)")) return;
    const t = e.target, tag = t && t.tagName;
    const typing = t && (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable);
    const emptyChatBox = t && t.id === "messageInput" && !t.value.trim();
    const altV = e.altKey && e.code === "KeyV";
    const space = e.code === "Space" && !e.altKey && !e.shiftKey && (!typing || emptyChatBox) && !["BUTTON", "SELECT", "A", "SUMMARY"].includes(tag);
    if (!altV && !space) return;
    e.preventDefault();
    liveVoiceBtn.click();
});

liveVoiceBtn.addEventListener("click", () => {
    isLiveModeActive = !isLiveModeActive;
    if (isLiveModeActive) {
        liveVoiceBtn.classList.add("live-active");
        speechRecognition.lang = speechLocale(convLang);
        try { speechRecognition.start(); } catch(e) {}
    } else {
        liveVoiceBtn.classList.remove("live-active");
        liveVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        try { speechRecognition.stop(); } catch(e) {}
        unmuteAfterSpeech(); 
    }
});


