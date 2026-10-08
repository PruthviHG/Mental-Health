// ==========================================
// --- REAL-TIME LIVE SPEECH CHAT & EMOTION (LOCAL WAV2VEC2) ---
// ==========================================
let isLiveModeActive = false;
let speechRecognition = null;
let mediaRecorder = null;
let audioChunks = [];

const liveVoiceBtn = document.getElementById("liveVoiceBtn");
const messageInput = document.getElementById("messageInput");


// Latest emotion estimate from the local Wav2Vec2 model:
// { label, confidence (0-1), scores, ts }
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
    try {
        const formData = new FormData();
        const ext = ((audioBlob.type || 'audio/webm').split('/')[1] || 'webm').split(';')[0];
        formData.append("audio", audioBlob, `voice.${ext}`);

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
    speechRecognition.lang = MINDSENCE.speechLang;

    speechRecognition.onstart = async function() {
        stopAI(); // Interruption trigger
        liveVoiceBtn.innerHTML = '<i class="fas fa-satellite-dish"></i>';
        messageInput.placeholder = "Listening to your voice... 🤍";
        
        muteForSpeech(); 

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                unmuteAfterSpeech(); 
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                await Promise.race([analyzeAudioEmotion(audioBlob), new Promise(r => setTimeout(r, 1500))]);
                stream.getTracks().forEach(track => track.stop());
                
                if (messageInput.value.trim() !== "" && isLiveModeActive) {
                    document.getElementById("sendButton").click();
                }
            };
            mediaRecorder.start();
        } catch (err) { console.error("Mic access denied:", err); }
    };

    speechRecognition.onresult = function(event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) messageInput.value = finalTranscript;
    };

    speechRecognition.onend = function() {
        liveVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        messageInput.placeholder = "Message your friend... 🤍";
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); 
        }
    };
} else { liveVoiceBtn.style.display = 'none'; }

liveVoiceBtn.addEventListener("click", () => {
    isLiveModeActive = !isLiveModeActive;
    if (isLiveModeActive) {
        liveVoiceBtn.classList.add("live-active");
        try { speechRecognition.start(); } catch(e) {}
    } else {
        liveVoiceBtn.classList.remove("live-active");
        liveVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        try { speechRecognition.stop(); } catch(e) {}
        unmuteAfterSpeech(); 
    }
});


