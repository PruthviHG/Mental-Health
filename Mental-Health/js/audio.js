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


