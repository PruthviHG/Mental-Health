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
    if (!nexusVoicePlayer.paused) {
        nexusVoicePlayer.pause();
        nexusVoicePlayer.currentTime = 0;
        unmuteAfterSpeech();
    }
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
    const thinkingIndicators = document.querySelectorAll('.animate-pulse');
    thinkingIndicators.forEach(el => el.remove());
}

// ==========================================
// --- REAL-TIME LIVE SPEECH CHAT & EMOTION (LOCAL WAV2VEC2) ---
// ==========================================
let isLiveModeActive = false;
let speechRecognition = null;
let mediaRecorder = null;
let audioChunks = [];
let detectedEmotion = "neutral";

const liveVoiceBtn = document.getElementById("liveVoiceBtn");
const messageInput = document.getElementById("messageInput");

const EMOTION_API_URL = "http://127.0.0.1:5000/analyze-emotion"; 

async function analyzeAudioEmotion(audioBlob) {
    try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.wav");

        const response = await fetch(EMOTION_API_URL, {
            method: "POST",
            body: formData,
        });
        
        const result = await response.json();
        if (result.emotion) {
            detectedEmotion = result.emotion; 
            console.log("Detected Voice Emotion:", detectedEmotion);
        }
    } catch (error) {
        console.error("Local Emotion Server Error:", error);
    }
}

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false; 
    speechRecognition.interimResults = true; 
    speechRecognition.lang = 'en-US';

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
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await analyzeAudioEmotion(audioBlob);
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


// ==========================================
// --- LOCAL ENDPOINTS CONFIG ---
// ==========================================
const LOCAL_BACKEND_URL = "http://127.0.0.1:5000";
const OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate";
const LOCAL_MODEL = "llama3.2:3b"; // or "mistral:7b"

// WARM-UP ROUTINE
fetch(OLLAMA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LOCAL_MODEL, prompt: "", keep_alive: "1h" })
}).catch(() => console.log("Ollama warm-up initiated."));


// ==========================================
// --- LOCAL NEURAL TTS (EDGE-TTS WITH HIDDEN TAGS) ---
// ==========================================
const nexusVoicePlayer = new Audio();

async function playLocalVoice(text) {
    let ttsText = text
        .replace(/\[sigh\]/gi, ' haah... ') 
        .replace(/\[hmm\]/gi, ' Hmm... ')
        .replace(/\[ahh\]/gi, ' Ahh... ')
        .replace(/\[oh\]/gi, ' Oh... ')
        .replace(/\[laugh\]/gi, ' heh... ')
        .replace(/\[.*?\]|\*.*?\*/g, ''); 

    const cleanText = ttsText
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .trim();

    if (cleanText.length === 0) {
        if (isLiveModeActive && window.location.protocol !== 'file:') {
            try { speechRecognition.start(); } catch(e) {}
        }
        return;
    }

    ttsAbortController = new AbortController();

    try {
        muteForSpeech();

        const response = await fetch(`${LOCAL_BACKEND_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ttsAbortController.signal,
            body: JSON.stringify({ text: cleanText })
        });

        if (!response.ok) throw new Error("TTS request failed");

        const blob = await response.blob();
        nexusVoicePlayer.src = URL.createObjectURL(blob);

        nexusVoicePlayer.onended = () => {
            unmuteAfterSpeech();
            if (isLiveModeActive && window.location.protocol !== 'file:') {
                try { speechRecognition.start(); } catch(e) {}
            }
        };

        await nexusVoicePlayer.play();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Local TTS Error:", error);
            unmuteAfterSpeech();
            if (isLiveModeActive && window.location.protocol !== 'file:') {
                try { speechRecognition.start(); } catch(e) {}
            }
        } else {
            console.log("Audio generation aborted by user interruption.");
        }
    }
}

// ==========================================
// --- AUTO-TYPE & EXPORT LOGIC ---
// ==========================================
document.addEventListener('keydown', (e) => {
    if (isArcadeActive || isRoomsActive || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.length === 1) messageInput.focus();
});

function exportChat() {
    let content = "MINDSENCE CHAT LOG\n=================================\n\n";
    const messages = chatbox.querySelectorAll('.msg-enter');
    messages.forEach(msg => {
        const isUser = msg.classList.contains('justify-end');
        const textElem = msg.querySelector(isUser ? 'div.bg-cyan-900\\/40' : '.ai-text');
        if(textElem) { content += (isUser ? "USER:\n" : "MINDSENCE:\n") + textElem.textContent.trim() + "\n\n"; }
    });
    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Mindsence_Chat_Log.doc"; a.click(); URL.revokeObjectURL(url);
}

// ==========================================
// --- CHAT AI LOGIC (OLLAMA API) ---
// ==========================================
const chatbox = document.getElementById("chatbox");
const sendButton = document.getElementById("sendButton");
const chatId = crypto.randomUUID();
let receiving = false;

const systemPromptBase = `You are Mindsence, the user's absolute best friend and emotional anchor. You have a warm, sweet, soothing "healing goddess" personality.
CRITICAL INSTRUCTIONS:
1. HIDDEN VOCALIZATIONS: You MUST use vocal fillers wrapped in brackets, such as [hmm], [ahh], [oh], [laugh], or [sigh]. Example: "[sigh] I know... [hmm] I'm here." Do NOT use asterisks for roleplay.
2. MIRROR LENGTH (ANTI-RAMBLE): NEVER over-explain. If the user asks a 5-word question, give a 1-sentence answer. Talk like a real friend texting back. Only give longer answers if the user writes a long, emotional message. 
3. NO GIMMICKS: Never introduce yourself with a long speech. Stop apologizing excessively.
4. DARK HUMOR OVERRIDE: If the user says edgy things (like "I want to kill you"), do NOT panic. Tease them back playfully with [laugh] or match their sarcasm.`;

messageInput.addEventListener('input', function() {
    this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = 'auto';
});

window.copyText = function(btn) {
    const text = btn.closest('.max-w-\\[90\\%\\]', '.max-w-\\[85\\%\\]').querySelector('.ai-text').textContent;
    navigator.clipboard.writeText(text);
    const original = btn.innerText; btn.innerText = "COPIED!";
    setTimeout(() => btn.innerText = original, 2000);
}

function createMessageElement(text, role) {
    const wrapper = document.createElement("div"); wrapper.className = `flex w-full msg-enter ${role === "user" ? "justify-end" : "justify-start"}`;
    const bubble = document.createElement("div"); let contentContainer, actionRow;

    if (role === "user") {
        bubble.className = "max-w-[90%] md:max-w-[85%] bg-cyan-900/40 border border-cyan-500/30 text-cyan-50 px-4 py-2 md:px-5 md:py-3 rounded-lg rounded-br-sm shadow-[0_0_15px_rgba(69,243,255,0.1)] font-mono text-[13px] md:text-sm";
        bubble.textContent = text;
    } else {
        wrapper.className += " gap-2 md:gap-4";
        const avatar = document.createElement("div");
        avatar.className = "flex-none w-6 h-6 md:w-8 md:h-8 rounded bg-cyan-500/10 border border-cyan-400 flex items-center justify-center mt-1 text-cyan-400 font-bold font-mono text-[10px] md:text-xs shadow-[0_0_10px_rgba(69,243,255,0.2)]";
        avatar.innerHTML = "M"; wrapper.appendChild(avatar);

        bubble.className = "max-w-[90%] md:max-w-[85%] bg-transparent border-l-2 border-cyan-500/50 pl-3 md:pl-4 py-1";
        contentContainer = document.createElement("div"); contentContainer.className = "text-gray-300 ai-text"; contentContainer.textContent = text; bubble.appendChild(contentContainer);

        actionRow = document.createElement("div");
        actionRow.className = "flex gap-4 mt-3 pt-2 border-t border-cyan-500/20 text-cyan-500/70 text-[10px] font-mono justify-end w-full opacity-0 transition-opacity duration-300 pointer-events-none";
        actionRow.innerHTML = `<button class="hover:text-cyan-300 transition-colors pointer-events-auto" onclick="copyText(this)">COPY</button>`;
        bubble.appendChild(actionRow);
    }
    wrapper.appendChild(bubble); return { wrapper, contentContainer, actionRow };
}

async function streamLocalLLM(userMessage) {
    stopAI(); // Interruption trigger
    receiving = true;
    sendButton.disabled = true;

    llmAbortController = new AbortController();

    const currentDynamicPrompt = `${systemPromptBase}

Current local time: ${new Date().toLocaleString()}.
Acoustic emotion detected from user's voice: [${detectedEmotion}].
Quietly harmonize your tone to this emotion.`;

    const { wrapper, contentContainer, actionRow } = createMessageElement("", "ai");
    chatbox.appendChild(wrapper);
    contentContainer.innerHTML = '<span class="animate-pulse text-cyan-500">Thinking...</span>';

    let fullAiResponse = "";

    try {
        const response = await fetch(OLLAMA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: llmAbortController.signal,
            body: JSON.stringify({
                model: LOCAL_MODEL,
                prompt: userMessage,
                system: currentDynamicPrompt,
                stream: true,
                keep_alive: "1h", 
                options: {
                    temperature: 0.8,
                    top_p: 0.9,
                    num_predict: 150 
                }
            })
        });

        if (!response.ok) throw new Error("Local LLM offline or unreachable");

        contentContainer.textContent = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.response) {
                        fullAiResponse += parsed.response;
                        
                        // Strip brackets for UI text display only
                        const cleanDisplay = fullAiResponse.replace(/\[.*?\]|\*.*?\*/g, '').trim();
                        contentContainer.textContent = cleanDisplay;
                        
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                } catch (e) {}
            }
        }

        actionRow.classList.remove('opacity-0');
        if (fullAiResponse.trim()) {
            playLocalVoice(fullAiResponse);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('AI Generation Aborted by User.');
        } else {
            console.error("Local Chat Error:", err);
            contentContainer.innerHTML = "<br><span class='text-red-400 text-xs font-mono mt-2 block'>[LOCAL MODEL OFFLINE - CHECK OLLAMA]</span>";
        }
        actionRow.classList.remove('opacity-0');
    } finally {
        receiving = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
}

sendButton.addEventListener("click", () => {
    if (!receiving && messageInput.value.trim() !== "") {
        if (nexusVoicePlayer.src === "") nexusVoicePlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; 
        
        const messageText = messageInput.value.trim(); messageInput.value = ""; messageInput.style.height = 'auto';
        const { wrapper } = createMessageElement(messageText, "user"); chatbox.appendChild(wrapper);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        streamLocalLLM(messageText);
    }
});

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!receiving && messageInput.value.trim() !== "") sendButton.click(); }
});

setTimeout(() => {
    const initialGreetings = [
        "Hey... I'm so glad you're here. 🤍 Take a deep breath. You are safe now, and you are not alone. How are you really feeling today?",
        "Hey there. Just wanted to remind you that I'm right here with you. What's on your mind? 🌿",
        "Hi. 🤍 Take a slow, deep breath. I'm here to listen to whatever you want to talk about.",
        "Hey... checking in. You don't have to go through anything alone. How's your heart today? ✨",
        "Hey, I've got you. 🫂 Take all the time you need, but I'm here when you're ready. How are you?"
    ];
    const text = initialGreetings[Math.floor(Math.random() * initialGreetings.length)];
    const { wrapper } = createMessageElement(text, "ai"); chatbox.appendChild(wrapper);
}, 800);


// ==========================================
// --- EXTENDED AUDIO ENGINE ---
// ==========================================
function togglePlayer() { document.getElementById('floating-player').classList.toggle('open'); }

let audioContext, analyser, dataArray, source1, source2, isAudioInitialized = false, currentBassPulse = 0;

let audio1 = new Audio(); audio1.crossOrigin = "anonymous";
let audio2 = new Audio(); audio2.crossOrigin = "anonymous";
let activeAudio = 1;
let isMusicPlaying = false;
let userPausedMusic = false; 
let isTemporarilyMuted = false; 
const BASE_VOLUME = 0.15; 
let fadeInterval = null;
let isCrossfading = false;

const trackDisplay = document.getElementById('track-display');
const playBtnMain = document.getElementById('play-pause-btn');
const playBtnRooms = document.getElementById('rooms-local-play');

function initAudio() {
    if (isAudioInitialized) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser(); analyser.fftSize = 256; dataArray = new Uint8Array(analyser.frequencyBinCount);
    source1 = audioContext.createMediaElementSource(audio1);
    source2 = audioContext.createMediaElementSource(audio2);
    source1.connect(analyser); source2.connect(analyser); 
    analyser.connect(audioContext.destination); isAudioInitialized = true;
}

let playlist = [], currentTrackIndex = 0; 

const fallbackPlaylist = [
    { name: "Ocean Waves", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
    { name: "Night Crickets", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8b8175567.mp3" },
    { name: "Lofi Rain", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Forest Birds", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82e88a3854.mp3" },
    { name: "Calm Waterfall", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
    { name: "Gentle Breeze", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Deep Lofi Study", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8b8175567.mp3" },
    { name: "Midnight Campfire", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82e88a3854.mp3" },
    { name: "River Stream", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
    { name: "Zen Garden", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Distant Thunder", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8b8175567.mp3" },
    { name: "Wind Chimes", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82e88a3854.mp3" },
    { name: "Autumn Leaves", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
    { name: "Morning Meadow", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Cave Drops", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8b8175567.mp3" },
    { name: "Lofi Cafe", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82e88a3854.mp3" },
    { name: "Rain on Tent", url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
    { name: "Jungle Evening", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { name: "Soft Piano Ambience", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8b8175567.mp3" },
    { name: "Binaural Sleep", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82e88a3854.mp3" }
];

fetch('https://api.github.com/repos/PruthviHG/Mental-Health/contents/Only%20Musics?ref=7067c2c3c6833f9075b5e7a1214a3bce9f7c4346')
    .then(res => res.json())
    .then(data => {
        if(!Array.isArray(data)) throw new Error("Invalid Format");
        playlist = data.filter(f => f.name.match(/\.(mp3|wav|m4a)$/i)).map(f => ({ name: f.name.replace(/\.[^/.]+$/, ""), url: f.download_url }));
        if(playlist.length === 0) throw new Error("Empty Repo");
        audio1.src = playlist[0].url; trackDisplay.innerText = "▶ " + playlist[0].name.substring(0, 25) + "...";
        attemptAutoplay();
    })
    .catch(err => {
        console.warn("Using Fallback Audio"); playlist = fallbackPlaylist;
        document.getElementById('audio-status').innerText = "/// 20 NATURE & LOFI TRACKS READY";
        audio1.src = playlist[0].url; trackDisplay.innerText = "▶ " + playlist[0].name.substring(0, 25) + "...";
        attemptAutoplay();
    });

function attemptAutoplay() {
    audio1.volume = BASE_VOLUME;
    let playPromise = audio1.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isMusicPlaying = true;
            userPausedMusic = false;
            syncPlayPauseUI();
            initAudio();
        }).catch(error => {
            document.body.addEventListener('click', function startAutoplay() {
                if (!isMusicPlaying && !userPausedMusic) {
                    toggleMainPlay();
                    document.body.removeEventListener('click', startAutoplay);
                }
            }, { once: true });
        });
    }
}

function syncPlayPauseUI() {
    const icon = isMusicPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    playBtnMain.innerHTML = icon; playBtnRooms.innerHTML = icon;
}

function toggleMainPlay() {
    initAudio(); if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    const current = activeAudio === 1 ? audio1 : audio2;
    if (isMusicPlaying) { 
        current.pause(); 
        isMusicPlaying = false; 
        userPausedMusic = true; 
    } 
    else { 
        current.volume = BASE_VOLUME;
        current.play(); 
        isMusicPlaying = true; 
        userPausedMusic = false; 
    }
    syncPlayPauseUI();
}

function muteForSpeech() {
    if (isMusicPlaying && !userPausedMusic) {
        const current = activeAudio === 1 ? audio1 : audio2;
        current.volume = 0; 
        isTemporarilyMuted = true;
    }
}

function unmuteAfterSpeech() {
    if (isMusicPlaying && !userPausedMusic && isTemporarilyMuted) {
        const current = activeAudio === 1 ? audio1 : audio2;
        current.volume = BASE_VOLUME; 
        isTemporarilyMuted = false;
    }
}

function crossfadeTrack(index) {
    if(!playlist[index] || isCrossfading) return;
    isCrossfading = true;
    initAudio(); if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    
    trackDisplay.innerText = "▶ " + playlist[index].name.substring(0, 25) + "...";
    
    const fadingOut = activeAudio === 1 ? audio1 : audio2;
    const fadingIn = activeAudio === 1 ? audio2 : audio1;

    fadingIn.src = playlist[index].url;
    fadingIn.volume = 0;
    if(isMusicPlaying && !isTemporarilyMuted) fadingIn.play();

    const steps = 20; const stepTime = 1500 / steps; const fadeStep = BASE_VOLUME / steps;
    
    if (fadeInterval) clearInterval(fadeInterval);
    
    fadeInterval = setInterval(() => {
        if (fadingOut.volume > fadeStep) fadingOut.volume -= fadeStep; else fadingOut.volume = 0;
        if (fadingIn.volume < BASE_VOLUME - fadeStep) fadingIn.volume += fadeStep; else fadingIn.volume = BASE_VOLUME;
        
        if (fadingIn.volume >= BASE_VOLUME) {
            fadingIn.volume = BASE_VOLUME; fadingOut.volume = 0; fadingOut.pause();
            activeAudio = activeAudio === 1 ? 2 : 1;
            isCrossfading = false;
            clearInterval(fadeInterval);
        }
    }, stepTime);
}

audio1.addEventListener('ended', nextTrack);
audio2.addEventListener('ended', nextTrack);

function nextTrack() { currentTrackIndex = currentTrackIndex + 1 >= playlist.length ? 0 : currentTrackIndex + 1; crossfadeTrack(currentTrackIndex); }
function prevTrack() { currentTrackIndex = currentTrackIndex - 1 < 0 ? playlist.length - 1 : currentTrackIndex - 1; crossfadeTrack(currentTrackIndex); }

document.getElementById('next-btn').addEventListener('click', nextTrack);
document.getElementById('prev-btn').addEventListener('click', prevTrack);
playBtnMain.addEventListener('click', toggleMainPlay);
playBtnRooms.addEventListener('click', toggleMainPlay);


// ==========================================
// --- 3D BACKGROUND ---
// ==========================================
let scene, camera, renderer, particles_3d;

let count = window.innerWidth < 768 ? 20000 : 100000;
let positions = new Float32Array(count * 3), targetPositions = new Float32Array(count * 3);

function init3D() {
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 10;
        const theta = Math.random() * Math.PI * 2, phi = Math.acos((Math.random() * 2) - 1), r = 2.5;
        if (i % 3 === 0) targetPositions[i] = r * Math.sin(phi) * Math.cos(theta);
        if (i % 3 === 1) targetPositions[i] = r * Math.sin(phi) * Math.sin(theta);
        if (i % 3 === 2) targetPositions[i] = r * Math.cos(phi);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles_3d = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x45f3ff, size: 0.012, transparent: true, opacity: 0.4 }));
    scene.add(particles_3d);
}

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => { if(isArcadeActive || isRoomsActive) return; mouseX = (e.clientX / window.innerWidth - 0.5); mouseY = (e.clientY / window.innerHeight - 0.5); });

function animate3D() {
    requestAnimationFrame(animate3D); 
    if(isArcadeActive || isRoomsActive) return;

    if (isAudioInitialized && isMusicPlaying && !isTemporarilyMuted) {
        analyser.getByteFrequencyData(dataArray);
        let bassSum = 0; for(let i = 0; i < 10; i++) bassSum += dataArray[i];
        currentBassPulse = ((bassSum / 10) / 255) * 2.0; 
    } else { currentBassPulse = Math.max(0, currentBassPulse - 0.05); }
    
    const posArr = particles_3d.geometry.attributes.position.array; let totalExplosion = currentBassPulse; 
    for (let i = 0; i < count * 3; i++) posArr[i] += ((targetPositions[i] * (1 + totalExplosion)) - posArr[i]) * 0.1;
    particles_3d.geometry.attributes.position.needsUpdate = true;
    particles_3d.rotation.y += 0.001 + (currentBassPulse * 0.005); particles_3d.rotation.x += mouseY * 0.02; particles_3d.rotation.z += mouseX * 0.02;
    
    renderer.render(scene, camera);
}
init3D(); animate3D(); 
window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    if (window.innerWidth < 768 && count > 30000) location.reload();
});


// ==========================================
// --- EXTENDED ROOMS GALLERY LOGIC ---
// ==========================================
const roomsData = {
    "golden hour": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208089_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208105_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208106_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208649_large.mp4"],
    "study": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/0f661a896986d20c078fbac8b0c136508de406bc/videos/130878-748595919.mp4"],
    "scary": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/136334-764387851.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/dark.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/dark1.mp4"],
    "classic": [""],
    "lofi": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/270983_large.mp4"],
    "bath": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/0f661a896986d20c078fbac8b0c136508de406bc/videos/205001-926015670_medium.mp4"],
    "treehouse": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/205634-927347905.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/tree.mp4"]
};

const dynamicRooms = {
    "space": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/space?ref=abecb14840be3498a1cfa284b50fe2c8e633e208",
    "nature": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/nature?ref=66d6789b1c439ce2787648c92f633e3908e3b54c",
    "rain": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/rain?ref=ce97064825d2e8d1a82c1b24a31414cf3bb3c743",
    "anime": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/anime?ref=823439b25045f7b53ca2b6f304b02cefe261d010"
};

const roomsModal = document.getElementById('rooms-modal');
const roomsMenuView = document.getElementById('rooms-menu-view');
const roomsVideoView = document.getElementById('rooms-video-view');
const roomsGalleryGrid = document.getElementById('rooms-gallery-grid');
const roomsVideoPlayer = document.getElementById('rooms-video-player');

let roomsPreloaded = false;
const preloadedBlobs = {};

Object.keys(dynamicRooms).forEach(room => {
    fetch(dynamicRooms[room])
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                roomsData[room] = data.filter(f => f.name.match(/\.(mp4|webm)$/i)).map(f => f.download_url);
                if (roomsPreloaded && roomsData[room].length > 0) {
                    const btn = document.createElement('div'); btn.className = 'room-card'; btn.innerText = room;
                    btn.onclick = () => openSpecificRoom(room, roomsData[room]);
                    roomsGalleryGrid.appendChild(btn);
                    roomsData[room].forEach(async url => {
                        try { const res = await fetch(url); const blob = await res.blob(); preloadedBlobs[url] = URL.createObjectURL(blob); } catch(e) {}
                    });
                }
            }
        }).catch(e => console.log("GitHub API Fetch Error for", room, e));
});

function openRooms() {
    isRoomsActive = true; 
    roomsModal.style.display = 'block'; 
    setTimeout(() => roomsModal.style.opacity = '1', 10);
    
    if(!roomsPreloaded) {
        roomsGalleryGrid.innerHTML = '';
        Object.keys(roomsData).forEach(roomName => {
            if(!roomsData[roomName] || roomsData[roomName].length === 0 || roomsData[roomName][0] === "") return;
            const btn = document.createElement('div'); btn.className = 'room-card'; btn.innerText = roomName;
            btn.onclick = () => openSpecificRoom(roomName, roomsData[roomName]);
            roomsGalleryGrid.appendChild(btn);
        });
        
        const urls = Object.values(roomsData).flat().filter(url => url !== "");
        urls.forEach(async url => {
            try { const res = await fetch(url); const blob = await res.blob(); preloadedBlobs[url] = URL.createObjectURL(blob); } catch(e) {}
        });
        roomsPreloaded = true;
    }
}

function closeRooms() {
    isRoomsActive = false;
    roomsModal.style.opacity = '0'; 
    setTimeout(() => roomsModal.style.display = 'none', 500);
    roomsVideoPlayer.pause();
}

const fireflyCanvas = document.getElementById('firefly-canvas');
const fCtx = fireflyCanvas.getContext('2d');
let fireflies = [];

window.addEventListener('resize', () => { fireflyCanvas.width = window.innerWidth; fireflyCanvas.height = window.innerHeight; });
fireflyCanvas.width = window.innerWidth; fireflyCanvas.height = window.innerHeight;

const fireflyConfigs = {
    "golden hour": { color: "255, 215, 0", glowColor: "255, 215, 0", count: 35, size: 2.5, blur: 12 },
    "study": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 20, size: 1.5, blur: 5 },
    "scary": { color: "5, 5, 5", glowColor: "0, 0, 0", count: 25, size: 3, blur: 8 },
    "lofi": { color: "200, 100, 255", glowColor: "200, 100, 255", count: 40, size: 2, blur: 15 },
    "bath": { color: "173, 216, 230", glowColor: "135, 206, 235", count: 35, size: 2, blur: 12 },
    "treehouse": { color: "144, 238, 144", glowColor: "144, 238, 144", count: 50, size: 2, blur: 10 },
    "space": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 60, size: 1.5, blur: 5 },
    "nature": { color: "144, 238, 144", glowColor: "34, 139, 34", count: 40, size: 2, blur: 10 },
    "rain": { color: "173, 216, 230", glowColor: "70, 130, 180", count: 30, size: 2, blur: 8 },
    "anime": { color: "255, 182, 193", glowColor: "255, 105, 180", count: 45, size: 2, blur: 15 },
    "classic": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 20, size: 1.5, blur: 5 }
};

class Firefly {
    constructor(c) {
        this.x = Math.random() * fireflyCanvas.width; this.y = Math.random() * fireflyCanvas.height;
        this.vx = (Math.random() - 0.5) * 1.5; this.vy = (Math.random() - 0.5) * 1.5;
        this.size = Math.random() * c.size + 1; this.color = c.color; this.glowColor = c.glowColor; this.blur = c.blur;
        this.alpha = Math.random(); this.alphaChange = (Math.random() * 0.02) - 0.01;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > fireflyCanvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > fireflyCanvas.height) this.vy *= -1;
        this.alpha += this.alphaChange; if(this.alpha <= 0.1 || this.alpha >= 1) this.alphaChange *= -1;
    }
    draw() {
        fCtx.beginPath(); fCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        fCtx.fillStyle = `rgba(${this.color}, ${Math.max(0, this.alpha)})`; fCtx.shadowBlur = this.blur;
        fCtx.shadowColor = `rgba(${this.glowColor}, ${Math.max(0, this.alpha)})`; fCtx.fill(); fCtx.shadowBlur = 0;
    }
}

function animateFireflies() {
    requestAnimationFrame(animateFireflies);
    if(isRoomsActive && !roomsVideoView.classList.contains('r-hidden')) {
        fCtx.clearRect(0, 0, fireflyCanvas.width, fireflyCanvas.height);
        fireflies.forEach(p => { p.update(); p.draw(); });
    }
}
animateFireflies();

let currentRoomSet = [], currentSceneIndex = 0;

function openSpecificRoom(roomName, videoArray) {
    currentRoomSet = videoArray; currentSceneIndex = 0;
    
    fireflies = []; const config = fireflyConfigs[roomName] || { color: "255, 255, 255", glowColor: "255, 255, 255", count: 30, size: 2, blur: 10 };
    for(let i=0; i<config.count; i++) fireflies.push(new Firefly(config));

    roomsVideoPlayer.src = preloadedBlobs[currentRoomSet[0]] || currentRoomSet[0];
    roomsVideoPlayer.play();

    roomsMenuView.classList.remove('r-active'); roomsMenuView.classList.add('r-hidden');
    roomsVideoView.classList.remove('r-hidden'); roomsVideoView.classList.add('r-active');

    if (videoArray.length > 1) document.getElementById('rooms-next-scene-btn').classList.remove('hidden');
    else document.getElementById('rooms-next-scene-btn').classList.add('hidden');
}

document.getElementById('rooms-next-scene-btn').onclick = () => {
    currentSceneIndex = (currentSceneIndex + 1) % currentRoomSet.length;
    roomsVideoPlayer.src = preloadedBlobs[currentRoomSet[currentSceneIndex]] || currentRoomSet[currentSceneIndex];
    roomsVideoPlayer.play();
};

document.getElementById('rooms-back-btn').onclick = () => {
    roomsVideoPlayer.pause(); roomsVideoPlayer.src = ""; fireflies = [];
    roomsVideoView.classList.remove('r-active'); roomsVideoView.classList.add('r-hidden');
    roomsMenuView.classList.remove('r-hidden'); roomsMenuView.classList.add('r-active');
};

// ==========================================
// --- "MIME" ROOM CHAT OVERLAY ---
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const roomsView = document.getElementById('rooms-video-view');
    if (roomsView) {
        const mimeBtn = document.createElement('button');
        mimeBtn.innerHTML = '<i class="fas fa-comment-dots mr-2"></i>MIME';
        mimeBtn.className = 'absolute top-6 right-24 bg-black/60 border border-cyan-500/50 text-cyan-400 font-mono text-xs px-3 py-1.5 rounded hover:bg-cyan-500/20 transition-all z-[60] shadow-[0_0_10px_rgba(69,243,255,0.2)]';
        roomsView.appendChild(mimeBtn);

        let mimeActive = false;
        mimeBtn.addEventListener('click', () => {
            mimeActive = !mimeActive;
            const mainUi = document.getElementById('main-ui');
            const roomsModal = document.getElementById('rooms-modal');
            const canvasContainer = document.getElementById('canvas-container');
            
            if (mimeActive) {
                mimeBtn.innerHTML = '<i class="fas fa-times mr-2"></i>EXIT MIME';
                mimeBtn.classList.replace('text-cyan-400', 'text-red-400');
                mimeBtn.classList.replace('border-cyan-500/50', 'border-red-400/50');
                
                roomsModal.style.backgroundColor = 'transparent';
                roomsModal.style.zIndex = '-1'; 
                mainUi.style.opacity = '1';
                mainUi.style.pointerEvents = 'auto';
                if(canvasContainer) canvasContainer.style.opacity = '0';
            } else {
                mimeBtn.innerHTML = '<i class="fas fa-comment-dots mr-2"></i>MIME';
                mimeBtn.classList.replace('text-red-400', 'text-cyan-400');
                mimeBtn.classList.replace('border-red-400/50', 'border-cyan-500/50');
                
                roomsModal.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
                roomsModal.style.zIndex = '50';
                mainUi.style.opacity = '0';
                mainUi.style.pointerEvents = 'none';
                if(canvasContainer) canvasContainer.style.opacity = '1';
            }
        });
    }
});


// ==========================================
// --- ARCADE LOGIC ---
// ==========================================
const modal = document.getElementById('game-modal'), ui = document.getElementById('main-ui'), canvas = document.getElementById('game-canvas'), ctx = canvas.getContext('2d'), gameOverScreen = document.getElementById('game-over-screen'), introScreen = document.getElementById('game-intro-screen');
let gameLoopId, currentGame = null, score = 0, frameCount = 0, isGameOver = false;
let pX = 400, pY = 250, entities = [], bullets = [], bricks = [], sDir = {x: 10, y: 0}, sTrail = [], apple = {x: 200, y: 200}, ball = {x: 400, y: 400, vx: 5, vy: -5, r: 6};
let flowGrid = [], flowPath = [], activeColor = null, isDrawing = false, hikePlayer = {x: 400, y: 250}, hikeCamera = {x:0, y:0}, hikeItems = [], hikeTrees = [], keys = {w:false, a:false, s:false, d:false, up:false, down:false, left:false, right:false}, farmGrid = [];

let rxState = 0, rxTriggerTime = 0, rxResult = 0, rxTimeoutId = null;

const yogaBgImg = new Image();
yogaBgImg.src = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80";

const gameData = {
    'surge': { title: "NEON SURGE", color: "#45f3ff", btnClass: "btn-surge", desc: "Dodge the incoming red geometric shapes." },
    'snake': { title: "QUANTUM SNAKE", color: "#39ff14", btnClass: "btn-snake", desc: "Collect data nodes to grow your tail." },
    'defend': { title: "PULSE DEFENDER", color: "#ff003c", btnClass: "btn-defend", desc: "Click to shoot incoming anomalies." },
    'breaker': { title: "NEON BREAKER", color: "#ff00ff", btnClass: "btn-breaker", desc: "Bounce ball upward to shatter bricks." },
    'dash': { title: "HYPER DASH", color: "#ffaa00", btnClass: "btn-dash", desc: "Navigate high-speed tunnel." },
    'flow': { title: "DATA LINK", color: "#8A2BE2", btnClass: "btn-flow", desc: "Connect matching colored nodes." },
    'hike': { title: "ZEN HIKE", color: "#2E8B57", btnClass: "btn-hike", desc: "Wander through the digital forest." },
    'farm': { title: "NEON FARM", color: "#DAA520", btnClass: "btn-farm", desc: "Plant digital seeds, harvest crops." },
    'breathe': { title: "BOX BREATHING", color: "#00ffcc", btnClass: "btn-breathe", desc: "Follow expanding and contracting circle." },
    'yoga': { title: "DESK YOGA", color: "#ff66b2", btnClass: "btn-yoga", desc: "Follow on-screen stretch patterns." },
    'reaction': { title: "NEON REFLEX", color: "#ffffff", btnClass: "btn-reaction", desc: "Test your speed. Click the exact moment the screen turns green!" }
};

function openArcade() { isArcadeActive = true; modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10); ui.style.opacity = '0'; showMenu(); }
function closeArcade() { nukeMemory(); gameOverScreen.style.display = 'none'; modal.style.opacity = '0'; setTimeout(() => modal.style.display = 'none', 500); ui.style.opacity = '1'; isArcadeActive = false; }
function showMenu() { nukeMemory(); gameOverScreen.style.display = 'none'; document.getElementById('game-container').style.display = 'none'; document.getElementById('arcade-view').style.display = 'flex'; document.getElementById('back-to-menu-btn').style.display = 'none'; document.body.style.cursor = 'default'; }

function nukeMemory() { 
    cancelAnimationFrame(gameLoopId); 
    currentGame = null; isGameOver = false; entities = []; bullets = []; sTrail = []; bricks = []; flowGrid = []; hikeItems = []; farmGrid = []; 
    isDrawing = false; activeColor = null; 
    clearTimeout(rxTimeoutId); rxState = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

function prepareGame(gameId) {
    nukeMemory(); gameOverScreen.style.display = 'none'; document.getElementById('arcade-view').style.display = 'none'; document.getElementById('game-container').style.display = 'flex'; document.getElementById('back-to-menu-btn').style.display = 'block';
    const data = gameData[gameId]; currentGame = gameId; introScreen.style.display = 'flex'; canvas.style.display = 'none'; document.getElementById('game-score').style.display = 'none';
    document.getElementById('intro-title').innerText = data.title; document.getElementById('intro-title').style.color = data.color; document.getElementById('intro-desc').innerText = data.desc;
    document.getElementById('start-game-btn').className = `arcade-btn font-mono ${data.btnClass}`;
}

function startGameReal() {
    introScreen.style.display = 'none'; canvas.style.display = 'block'; document.getElementById('game-score').style.display = 'block'; canvas.style.borderColor = gameData[currentGame].color;
    score = 0; frameCount = 0; pX = 400; pY = 250; isGameOver = false;
    if(currentGame === 'snake') { sDir = {x: 10, y: 0}; for(let i=0; i<5; i++) sTrail.push({x: pX - i*10, y: pY}); apple={x:Math.floor(Math.random()*79)*10, y:Math.floor(Math.random()*49)*10}; } 
    else if(currentGame === 'breaker') { ball = {x: 400, y: 300, vx: 5, vy: 5, r: 6}; for(let r=0; r<6; r++) for(let c=0; c<10; c++) bricks.push({x: c*75 + 25, y: r*30 + 30, w: 70, h: 20, active: true}); } 
    else if(currentGame === 'flow') { initFlow(); } else if(currentGame === 'hike') { initHike(); } else if(currentGame === 'farm') { initFarm(); }
    else if(currentGame === 'reaction') { initReaction(); }
    gameLoopId = requestAnimationFrame(gameRouter);
}

function gameOver(customMessage = "SESSION ENDED") { 
    isGameOver = true; cancelAnimationFrame(gameLoopId); document.getElementById('game-over-title').innerText = customMessage; document.getElementById('game-over-title').style.color = gameData[currentGame].color; document.getElementById('final-score').innerText = "FINAL SCORE: " + score; 
    document.getElementById('retry-btn-dynamic').className = `arcade-btn font-mono ${gameData[currentGame].btnClass}`; gameOverScreen.style.display = 'flex'; 
}
function retryGame() { gameOverScreen.style.display = 'none'; startGameReal(); }

canvas.addEventListener('mousemove', (e) => { if(!isGameOver && introScreen.style.display !== 'flex'){ const r = canvas.getBoundingClientRect(); pX = (e.clientX - r.left) * (canvas.width / r.width); pY = (e.clientY - r.top) * (canvas.height / r.height); } });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if(!isGameOver && introScreen.style.display !== 'flex'){ const r = canvas.getBoundingClientRect(); pX = (e.touches[0].clientX - r.left) * (canvas.width / r.width); pY = (e.touches[0].clientY - r.top) * (canvas.height / r.height); } }, {passive: false});

canvas.addEventListener('mousedown', (e) => { 
    if(!isGameOver && introScreen.style.display !== 'flex'){ 
        const r=canvas.getBoundingClientRect(), mx=(e.clientX-r.left)*(800/r.width), my=(e.clientY-r.top)*(500/r.height); 
        if(currentGame==='defend'){const angle=Math.atan2(my-250,mx-400);bullets.push({x:400,y:250,vx:Math.cos(angle)*10,vy:Math.sin(angle)*10});} 
        if(currentGame==='farm'){clickFarm(mx,my);} 
        if(currentGame==='flow'){isDrawing=true;pX=mx;pY=my;checkFlowNode(mx,my);} 
        if(currentGame==='reaction'){clickReaction();}
    } 
});

canvas.addEventListener('mouseup', () => { if(currentGame === 'flow') { isDrawing = false; activeColor = null; }});

window.addEventListener('keydown', (e) => { if(!isGameOver && isArcadeActive && introScreen.style.display !== 'flex'){ const k=e.key.toLowerCase(); if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){if(k==='w'||k==='arrowup')keys.up=true;if(k==='s'||k==='arrowdown')keys.down=true;if(k==='a'||k==='arrowleft')keys.left=true;if(k==='d'||k==='arrowright')keys.right=true;} if(currentGame==='snake'){if(keys.up&&sDir.y===0)sDir={x:0,y:-10};if(keys.down&&sDir.y===0)sDir={x:0,y:10};if(keys.left&&sDir.x===0)sDir={x:-10,y:0};if(keys.right&&sDir.x===0)sDir={x:10,y:0};} } });
window.addEventListener('keyup', (e) => { const k=e.key.toLowerCase(); if(k==='w'||k==='arrowup')keys.up=false;if(k==='s'||k==='arrowdown')keys.down=false;if(k==='a'||k==='arrowleft')keys.left=false;if(k==='d'||k==='arrowright')keys.right=false; });

function gameRouter() {
    if(!currentGame || isGameOver) return; 
    
    if (currentGame !== 'reaction') {
        ctx.fillStyle = currentGame === 'hike' ? '#1a2e24' : (currentGame === 'farm' ? '#111' : (currentGame === 'snake' ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.3)')); 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
    }
    
    if(currentGame === 'surge') playSurge(); 
    else if(currentGame === 'snake') playSnake(); 
    else if(currentGame === 'defend') playDefend(); 
    else if(currentGame === 'breaker') playBreaker(); 
    else if(currentGame === 'dash') playDash(); 
    else if(currentGame === 'flow') playFlow(); 
    else if(currentGame === 'hike') playHike(); 
    else if(currentGame === 'farm') playFarm(); 
    else if(currentGame === 'breathe') playBreathe(); 
    else if(currentGame === 'yoga') playYoga();
    else if(currentGame === 'reaction') playReaction();
    
    if (currentGame === 'breathe' || currentGame === 'yoga') {
        document.getElementById('game-score').innerText = "SESSION TIME: " + Math.floor(frameCount / 60) + "s";
    } else if (currentGame === 'reaction') {
        document.getElementById('game-score').innerText = rxState === 4 ? "LATEST: " + Math.floor(rxResult) + "ms" : "TESTING...";
    } else {
        document.getElementById('game-score').innerText = "SCORE: " + score; 
    }
    
    if(!isGameOver) { frameCount++; gameLoopId = requestAnimationFrame(gameRouter); }
}

function initReaction() { 
    clearTimeout(rxTimeoutId); 
    rxState = 1; 
    rxResult = 0; 
    let delay = 1500 + Math.random() * 3000; 
    rxTimeoutId = setTimeout(() => { 
        rxState = 2; 
        rxTriggerTime = performance.now(); 
    }, delay); 
}

function clickReaction() { 
    if (rxState === 1) { 
        clearTimeout(rxTimeoutId); 
        rxState = 3; 
    } else if (rxState === 2) { 
        rxResult = performance.now() - rxTriggerTime; 
        rxState = 4; 
    } else if (rxState === 3 || rxState === 4) { 
        initReaction(); 
    } 
}

function playReaction() { 
    if (rxState === 1) { 
        ctx.fillStyle = '#ff003c'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("WAIT FOR GREEN...", 400, 250); 
    } else if (rxState === 2) { 
        ctx.fillStyle = '#39ff14'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#000'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("CLICK NOW!", 400, 250); 
    } else if (rxState === 3) { 
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#ff003c'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("TOO SOON!", 400, 230); 
        ctx.fillStyle = '#aaa'; ctx.font = '16px monospace'; ctx.fillText("Click anywhere to try again", 400, 270); 
    } else if (rxState === 4) { 
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#45f3ff'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText(Math.floor(rxResult) + " ms", 400, 230); 
        ctx.fillStyle = '#aaa'; ctx.font = '16px monospace'; ctx.fillText("Click anywhere to try again", 400, 280); 
    } 
}

const yogaPoses = [
    {name: "NECK ROLLS", desc: "Slowly roll your neck in gentle circles."},
    {name: "SHOULDER SHRUGS", desc: "Lift shoulders to ears, hold, and drop."},
    {name: "WRIST STRETCH", desc: "Extend arm, gently pull fingers back."},
    {name: "SEATED TWIST", desc: "Turn torso to the right, then switch left."},
    {name: "CHEST OPENER", desc: "Clasp hands behind your back and lift."}
];

function drawYogaAvatar(poseIndex, progress, time) {
    ctx.strokeStyle = '#ff66b2'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let cx = 400, cy = 350; 
    let headY = cy - 120, shoulderY = cy - 80, pelvisY = cy + 20;

    ctx.beginPath();
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx-40, pelvisY+40); ctx.lineTo(cx-20, pelvisY+50); 
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx+40, pelvisY+40); ctx.lineTo(cx+20, pelvisY+50); 
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx, shoulderY); 

    if (poseIndex === 0) { 
        let hx = cx + Math.cos(time * 0.05) * 15;
        let hy = headY + Math.sin(time * 0.05) * 15;
        ctx.arc(hx, hy, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-30, cy-40); ctx.lineTo(cx-15, cy); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+30, cy-40); ctx.lineTo(cx+15, cy);
    } 
    else if (poseIndex === 1) { 
        let sY = shoulderY - Math.abs(Math.sin(time * 0.05) * 20);
        ctx.arc(cx, headY, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx, sY); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx-35, cy-20); ctx.lineTo(cx-20, cy+20); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx+35, cy-20); ctx.lineTo(cx+20, cy+20);
    } 
    else if (poseIndex === 2) { 
        ctx.arc(cx, headY, 22, 0, Math.PI*2);
        let armSwitch = Math.floor(progress * 2); 
        if (armSwitch === 0) {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-90, shoulderY); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+50, shoulderY); ctx.lineTo(cx-80, shoulderY+10); 
        } else {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+90, shoulderY); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-50, shoulderY); ctx.lineTo(cx+80, shoulderY+10); 
        }
    } 
    else if (poseIndex === 3) { 
        ctx.arc(cx, headY, 22, 0, Math.PI*2);
        let twistSwitch = Math.floor(progress * 2); 
        if (twistSwitch === 0) {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+60, cy-40); ctx.lineTo(cx+40, cy+10); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-40, cy-40); 
        } else {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-60, cy-40); ctx.lineTo(cx-40, cy+10); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+40, cy-40); 
        }
    } 
    else if (poseIndex === 4) { 
        ctx.arc(cx, headY-10, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-40, cy-20); ctx.lineTo(cx-10, cy+30); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+40, cy-20); ctx.lineTo(cx+10, cy+30); 
    }
    ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}

function playYoga() {
    if (yogaBgImg && yogaBgImg.complete) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(yogaBgImg, 0, 0, 800, 500);
        ctx.globalAlpha = 1.0;
    }

    let poseDuration = 600; 
    let poseIndex = Math.floor(frameCount / poseDuration) % yogaPoses.length;
    let poseProgress = (frameCount % poseDuration) / poseDuration;
    let pose = yogaPoses[poseIndex];
    
    drawYogaAvatar(poseIndex, poseProgress, frameCount);

    ctx.fillStyle = '#ff66b2'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
    ctx.fillText(pose.name, 400, 100);
    ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
    ctx.fillText(pose.desc, 400, 140);
    
    ctx.fillStyle = 'rgba(255, 102, 178, 0.2)'; ctx.fillRect(200, 440, 400, 10);
    ctx.fillStyle = '#ff66b2'; ctx.fillRect(200, 440, 400 * poseProgress, 10);
    ctx.font = '12px monospace'; ctx.fillStyle = '#fff';
    ctx.fillText("Next pose in: " + Math.ceil(10 - (poseProgress * 10)) + "s", 400, 470);
}

function playBreathe() { let phase = Math.floor((frameCount % 960) / 240), progress = ((frameCount % 960) % 240) / 240; let radius = 50, text = ""; if(phase===0){radius=50+(100*progress);text="INHALE";}else if(phase===1){radius=150;text="HOLD";}else if(phase===2){radius=150-(100*progress);text="EXHALE";}else if(phase===3){radius=50;text="HOLD";} ctx.beginPath(); ctx.arc(400, 250, radius, 0, Math.PI*2); ctx.fillStyle='rgba(0,255,204,0.2)'; ctx.fill(); ctx.strokeStyle='#00ffcc'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='24px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text, 400, 250); }
function playSurge() { ctx.beginPath(); ctx.arc(pX, pY, 8, 0, Math.PI*2); ctx.fillStyle='#45f3ff'; ctx.fill(); if(frameCount%20===0) entities.push({x:Math.random()<0.5?-20:820,y:Math.random()*500,s:20,vx:(Math.random()<0.5?1:-1)*(Math.random()*4+2)}); for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x+=e.vx;ctx.fillStyle='#ff003c';ctx.fillRect(e.x,e.y,e.s,e.s);if(Math.hypot(pX-e.x,pY-e.y)<15){gameOver();return;}if(e.x<-50||e.x>850)entities.splice(i,1);} score++; }
function playSnake() { if(frameCount%4===0){pX+=sDir.x;pY+=sDir.y;sTrail.unshift({x:pX,y:pY});sTrail.pop();if(pX<0||pX>=800||pY<0||pY>=500||sTrail.slice(1).some(s=>s.x===pX&&s.y===pY)){gameOver();return;}if(Math.abs(pX-apple.x)<10&&Math.abs(pY-apple.y)<10){score+=100;sTrail.push({...sTrail[sTrail.length-1]});apple={x:Math.floor(Math.random()*79)*10,y:Math.floor(Math.random()*49)*10};}} ctx.fillStyle='#ff003c';ctx.fillRect(apple.x,apple.y,10,10);ctx.fillStyle='#39ff14';sTrail.forEach(s=>ctx.fillRect(s.x,s.y,10,10)); }
function playDefend() { ctx.beginPath();ctx.arc(400,250,15,0,Math.PI*2);ctx.fillStyle='#45f3ff';ctx.fill(); if(frameCount%40===0){let a=Math.random()*Math.PI*2;entities.push({x:400+Math.cos(a)*450,y:250+Math.sin(a)*450,a:a});} ctx.fillStyle='#fff';for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.x+=b.vx;b.y+=b.vy;ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();if(b.x<0||b.x>800||b.y<0||b.y>500)bullets.splice(i,1);} ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x-=Math.cos(e.a)*(1+score/1000);e.y-=Math.sin(e.a)*(1+score/1000);ctx.fillRect(e.x-10,e.y-10,20,20);if(Math.hypot(e.x-400,e.y-250)<20){gameOver();return;}for(let j=bullets.length-1;j>=0;j--){if(Math.hypot(e.x-bullets[j].x,e.y-bullets[j].y)<15){score+=50;entities.splice(i,1);bullets.splice(j,1);break;}}} }
function playBreaker() { let px=Math.max(0,Math.min(700,pX-50));ctx.fillStyle='#45f3ff';ctx.fillRect(px,470,100,10); ball.x+=ball.vx;ball.y+=ball.vy;if(ball.x<0||ball.x>800)ball.vx*=-1;if(ball.y<0)ball.vy*=-1;if(ball.y>500){gameOver();return;}if(ball.y+ball.r>470&&ball.x>px&&ball.x<px+100){ball.vy=-Math.abs(ball.vy);ball.vx=((ball.x-(px+50))/50)*6;} ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#ff00ff';ctx.fill(); ctx.fillStyle='#ff00ff';let ab=0;for(let i=0;i<bricks.length;i++){let b=bricks[i];if(b.active){ab++;ctx.fillRect(b.x,b.y,b.w,b.h);if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y-ball.r<b.y+b.h&&ball.y+ball.r>b.y){b.active=false;ball.vy*=-1;score+=10;}}}if(ab===0){ball.vx*=1.2;ball.vy*=1.2;bricks.forEach(b=>b.active=true);} }
function playDash() { ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.moveTo(pX,450);ctx.lineTo(pX-15,480);ctx.lineTo(pX+15,480);ctx.fill(); if(frameCount%(Math.max(10,30-Math.floor(score/100)))===0)entities.push({x:Math.random()*700,y:-20,w:Math.random()*100+50,h:20}); ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.y+=5+(score/200);ctx.fillRect(e.x,e.y,e.w,e.h);if(pX>e.x&&pX<e.x+e.w&&450<e.y+e.h&&480>e.y){gameOver();return;}if(e.y>500)entities.splice(i,1);}score++; }
function initFlow() { flowGrid=[];flowPath=[];let n=[{x:1,y:1,c:'#ff003c'},{x:5,y:5,c:'#ff003c'},{x:1,y:5,c:'#45f3ff'},{x:5,y:1,c:'#45f3ff'}];for(let c=0;c<7;c++){flowGrid[c]=[];for(let r=0;r<7;r++){let is=n.find(v=>v.x===c&&v.y===r);flowGrid[c][r]={x:c*70+150,y:r*70+10,color:is?is.c:null,isEnd:!!is,pathColor:null};}} }
function checkFlowNode(mx,my) { for(let c=0;c<7;c++)for(let r=0;r<7;r++){let cl=flowGrid[c][r];if(Math.hypot(mx-(cl.x+35),my-(cl.y+35))<30&&cl.isEnd){activeColor=cl.color;flowPath=[{c,r}];}} }
function playFlow() { for(let c=0;c<7;c++)for(let r=0;r<7;r++){let cl=flowGrid[c][r];ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.strokeRect(cl.x,cl.y,70,70);if(cl.isEnd){ctx.fillStyle=cl.color;ctx.beginPath();ctx.arc(cl.x+35,cl.y+35,20,0,Math.PI*2);ctx.fill();}else if(cl.pathColor){ctx.fillStyle=cl.pathColor;ctx.fillRect(cl.x+20,cl.y+20,30,30);}} if(isDrawing&&activeColor){let c=Math.floor((pX-150)/70),r=Math.floor((pY-10)/70);if(c>=0&&c<7&&r>=0&&r<7){let last=flowPath[flowPath.length-1];if(last&&(Math.abs(last.c-c)+Math.abs(last.r-r)===1)){let cl=flowGrid[c][r];if(!cl.pathColor||cl.pathColor===activeColor){if(!cl.isEnd||(cl.isEnd&&cl.color===activeColor)){cl.pathColor=activeColor;flowPath.push({c,r});score+=5;}}}}} if(score>500)gameOver("NETWORK RESTORED"); }
function initHike() { hikePlayer={x:400,y:250};hikeCamera={x:0,y:0};hikeItems=[];hikeTrees=[];for(let i=0;i<100;i++)hikeTrees.push({x:Math.random()*2000-600,y:Math.random()*2000-600,s:Math.random()*20+20});for(let i=0;i<20;i++)hikeItems.push({x:Math.random()*1500-350,y:Math.random()*1500-350,active:true}); }
function playHike() { let s=3;if(keys.up)hikePlayer.y-=s;if(keys.down)hikePlayer.y+=s;if(keys.left)hikePlayer.x-=s;if(keys.right)hikePlayer.x+=s;hikeCamera.x+=(hikePlayer.x-400-hikeCamera.x)*0.1;hikeCamera.y+=(hikePlayer.y-250-hikeCamera.y)*0.1; ctx.save();ctx.translate(-hikeCamera.x,-hikeCamera.y);ctx.fillStyle='#0a1712';hikeTrees.forEach(t=>ctx.fillRect(t.x,t.y,t.s,t.s*1.5));ctx.fillStyle='#45f3ff';hikeItems.forEach(i=>{if(i.active){ctx.beginPath();ctx.arc(i.x,i.y+Math.sin(frameCount*0.05)*5,5,0,Math.PI*2);ctx.fill();if(Math.hypot(hikePlayer.x-i.x,hikePlayer.y-i.y)<20){i.active=false;score+=50;}}});ctx.fillStyle='#fff';ctx.fillRect(hikePlayer.x-10,hikePlayer.y-10,20,20);ctx.restore();if(score>=1000)gameOver("PEAK REACHED"); }
function initFarm() { farmGrid=[];for(let c=0;c<5;c++){farmGrid[c]=[];for(let r=0;r<5;r++)farmGrid[c][r]={state:0,timer:0,x:c*80+225,y:r*80+50};} }
function clickFarm(mx,my) { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(mx>cl.x&&mx<cl.x+70&&my>cl.y&&my<cl.y+70){if(cl.state===0){cl.state=1;cl.timer=0;}else if(cl.state===2){cl.state=0;score+=100;}}} }
function playFarm() { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(cl.state===1){cl.timer++;if(cl.timer>200)cl.state=2;ctx.fillStyle='#2E8B57';}else if(cl.state===2)ctx.fillStyle='#DAA520';else ctx.fillStyle='#222';ctx.fillRect(cl.x,cl.y,70,70);} if(score>=2000)gameOver("HARVEST COMPLETE"); }

// ==========================================
// --- HUMAN-LIKE IDLE CHECK-IN ---
// ==========================================
let idleCheckTimer;

const idleCheckMessages = [
    "Hey... are you still there? [hmm] 🤍",
    "Did you have food yet?",
    "[sigh] Are you angry with me? 🥺",
    "Am I being boring? [laugh] You can tell me.",
    "Did you fall asleep on me? 🌙",
    "[hmm] What are you doing right now?",
    "Just checking in... everything okay?",
    "I'm still here if you need me.",
    "It's been a little quiet... you good? 🌿"
];

function sendIdleMessage() {
    if (receiving || isArcadeActive || isRoomsActive) {
        resetIdleCheckTimer();
        return; 
    }
    
    const randomMessage = idleCheckMessages[Math.floor(Math.random() * idleCheckMessages.length)];
    
    // STRIP BRACKETS FOR IDLE MESSAGES UI
    const cleanDisplay = randomMessage.replace(/\[.*?\]|\*.*?\*/g, '').trim(); 
    const { wrapper } = createMessageElement(cleanDisplay, "ai");
    document.getElementById("chatbox").appendChild(wrapper);
    
    if (typeof playLocalVoice === 'function') {
        playLocalVoice(randomMessage);
    }
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    resetIdleCheckTimer(); 
}

function resetIdleCheckTimer() {
    clearTimeout(idleCheckTimer);
    idleCheckTimer = setTimeout(sendIdleMessage, 300000); 
}

document.getElementById("messageInput").addEventListener("input", resetIdleCheckTimer);
document.getElementById("sendButton").addEventListener("click", resetIdleCheckTimer);

resetIdleCheckTimer();

// ==========================================
// --- FEEDBACK WIDGET & UI INJECTIONS ---
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. CREATE FEEDBACK WIDGET
    const fBtn = document.createElement('div');
    fBtn.innerHTML = '<i class="fas fa-envelope text-[14px]"></i>';
    fBtn.className = 'fixed bottom-4 right-4 w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 cursor-pointer hover:bg-cyan-500/30 hover:border-cyan-500 transition-all z-50 shadow-[0_0_10px_rgba(69,243,255,0.1)]';
    
    const fModal = document.createElement('div');
    fModal.className = 'fixed bottom-16 right-4 w-72 bg-gray-900/95 border border-cyan-500/30 rounded-xl p-4 hidden z-50 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-opacity duration-300';
    fModal.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-cyan-400 font-mono text-xs font-bold">/// FEEDBACK</h3>
            <button id="fb-close" class="text-gray-500 hover:text-red-400 transition-colors"><i class="fas fa-times"></i></button>
        </div>
        <input type="email" id="fb-email" placeholder="your mail id..." class="w-full bg-black/50 border border-cyan-500/20 rounded p-2 text-xs text-gray-200 font-mono mb-2 outline-none focus:border-cyan-500/50">
        <textarea id="fb-text" placeholder="what's on your mind?..." class="w-full bg-black/50 border border-cyan-500/20 rounded p-2 text-xs text-gray-200 font-mono h-20 mb-3 outline-none focus:border-cyan-500/50 resize-none"></textarea>
        <button id="fb-submit" class="w-full bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 font-mono text-xs py-2 rounded transition-colors tracking-widest">SEND</button>
        <div id="fb-status" class="text-[10px] text-center mt-2 font-mono text-cyan-400 hidden">Sent securely 🤍</div>
    `;

    document.body.appendChild(fBtn);
    document.body.appendChild(fModal);

    fBtn.onclick = () => {
        fModal.classList.toggle('hidden');
        if (!fModal.classList.contains('hidden')) document.getElementById('fb-text').focus();
    };
    
    document.getElementById('fb-close').onclick = () => fModal.classList.add('hidden');

    document.getElementById('fb-submit').onclick = () => {
        const email = document.getElementById('fb-email').value;
        const text = document.getElementById('fb-text').value;
        if(email && text) {
            fetch('http://127.0.0.1:5000/feedback', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, text, to: 'brucewayne4gmail.com'})
            }).catch(() => console.log('Backend offline, feedback dropped.'));
            
            document.getElementById('fb-submit').style.display = 'none';
            document.getElementById('fb-status').style.display = 'block';
            setTimeout(() => {
                fModal.classList.add('hidden');
                document.getElementById('fb-submit').style.display = 'block';
                document.getElementById('fb-status').style.display = 'none';
                document.getElementById('fb-text').value = '';
            }, 2000);
        }
    };
});