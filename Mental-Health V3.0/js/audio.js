// ==========================================
// --- MUSIC PLAYER (main widget + the player inside Rooms) ---
// Where the tracks come from, first match wins:
//   1. window.MINDSENCE_CONFIG.playlist = [{ name, url }, ...]
//   2. your own files: drop .mp3/.ogg/.wav/.m4a into assets/music/ (the server lists them at /music)
//   3. the GitHub music folder (list cached for a day so it is not fetched on every visit)
//   4. a small built-in list
// A track that fails to load is skipped, so the player never goes silent while claiming to play.
// ==========================================
function togglePlayer() { document.getElementById('floating-player').classList.toggle('open'); }

let audioContext, analyser, dataArray, source1, source2, isAudioInitialized = false, currentBassPulse = 0;

let audio1 = new Audio(); audio1.crossOrigin = "anonymous"; audio1.preload = "auto";
let audio2 = new Audio(); audio2.crossOrigin = "anonymous"; audio2.preload = "auto";
let activeAudio = 1;
let isMusicPlaying = false;
let userPausedMusic = false; 
let isTemporarilyMuted = false; 
let fadeInterval = null;
let isCrossfading = false;
let fadeState = null;
let consecutiveTrackErrors = 0;

// Volume: 0-100% of a gentle maximum, remembered between visits. The default equals the old fixed level (0.15).
const MUSIC_MAX_VOLUME = 0.4;
let musicPercent = (() => { try { const v = parseInt(localStorage.getItem("mindsence_music_volume"), 10); return v >= 0 && v <= 100 ? v : 38; } catch (e) { return 38; } })();
function musicVolume() { return (musicPercent / 100) * MUSIC_MAX_VOLUME; }
function targetVolume() { return isTemporarilyMuted ? 0 : musicVolume(); }
const BASE_VOLUME = musicVolume();                  // kept for older code that may read it

const trackDisplay = document.getElementById('track-display');
const roomsTrackLabel = document.getElementById('rooms-track');
const playBtnMain = document.getElementById('play-pause-btn');
const playBtnRooms = document.getElementById('rooms-local-play');
const volumeSliders = Array.from(document.querySelectorAll('.music-volume'));
const audioStatus = document.getElementById('audio-status');

function activeEl() { return activeAudio === 1 ? audio1 : audio2; }

function initAudio() {
    if (isAudioInitialized) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser(); analyser.fftSize = 256; dataArray = new Uint8Array(analyser.frequencyBinCount);
        source1 = audioContext.createMediaElementSource(audio1);
        source2 = audioContext.createMediaElementSource(audio2);
        source1.connect(analyser); source2.connect(analyser); 
        analyser.connect(audioContext.destination); isAudioInitialized = true;
    } catch (e) { console.warn("Audio analyser unavailable (music still plays):", e && e.message); }
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

function setStatus_audio(text) { if (audioStatus) audioStatus.innerText = text; }

function showTrack(index) {
    const name = playlist[index] ? playlist[index].name : "";
    const shown = name ? "▶ " + (name.length > 25 ? name.substring(0, 25) + "..." : name) : "No music";
    if (trackDisplay) trackDisplay.innerText = shown;
    if (roomsTrackLabel) roomsTrackLabel.innerText = name.length > 22 ? name.substring(0, 22) + "..." : name;
    if ('mediaSession' in navigator && window.MediaMetadata && name) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: name, artist: "Mindsence" }); } catch (e) { /* ignore */ } }
}

// ----- where the playlist comes from -----
function cleanPlaylist(list) {
    const seen = new Set(), out = [];
    (list || []).forEach(t => { if (t && typeof t.url === "string" && t.url && !seen.has(t.url)) { seen.add(t.url); out.push({ name: String(t.name || "Track").slice(0, 80), url: t.url }); } });
    return out;
}

// Small JSON cache in localStorage (GitHub's anonymous API allows only 60 calls an hour per address).
function fetchJsonCached(url, key, ttlMs) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { /* ignore */ }
    if (cached && Date.now() - cached.t < ttlMs) return Promise.resolve(cached.data);
    return fetch(url).then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); }).then(data => {
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* storage full or blocked */ }
        return data;
    }).catch(err => { if (cached) return cached.data; throw err; });                 // stale beats nothing
}

async function loadPlaylist() {
    const cfg = (typeof MINDSENCE !== "undefined" && MINDSENCE.playlist) || null;
    if (Array.isArray(cfg) && cleanPlaylist(cfg).length) return { list: cleanPlaylist(cfg), label: "/// YOUR PLAYLIST" };
    try {
        const res = await fetch("/music", { cache: "no-store" });
        if (res.ok) { const d = await res.json(); const l = cleanPlaylist(d.tracks); if (l.length) return { list: l, label: `/// ${l.length} TRACKS ON THIS SERVER` }; }
    } catch (e) { /* no local music: carry on */ }
    try {
        const data = await fetchJsonCached('https://api.github.com/repos/PruthviHG/Mental-Health/contents/Only%20Musics?ref=7067c2c3c6833f9075b5e7a1214a3bce9f7c4346', "mindsence_music_list", 24 * 3600 * 1000);
        if (!Array.isArray(data)) throw new Error("Invalid Format");
        const l = cleanPlaylist(data.filter(f => /\.(mp3|wav|m4a|ogg)$/i.test(f.name)).map(f => ({ name: f.name.replace(/\.[^/.]+$/, ""), url: f.download_url })));
        if (!l.length) throw new Error("Empty Repo");
        return { list: l, label: `/// ${l.length} TRACKS READY` };
    } catch (err) {
        console.warn("Using fallback music list:", err && err.message);
        const l = cleanPlaylist(fallbackPlaylist);
        return { list: l, label: `/// ${l.length} NATURE & LOFI TRACKS READY` };
    }
}

// ----- playing -----
function safePlay(el) {
    const p = el.play();
    if (p && p.catch) p.catch(err => {
        if (err && err.name === "AbortError") return;                       // a newer load replaced this one: normal
        if (err && err.name === "NotAllowedError") { isMusicPlaying = false; syncPlayPauseUI(); return; }   // browser wants a click first
        console.warn("Music could not start:", err && err.message);
    });
    return p;
}

function syncPlayPauseUI() {
    const icon = isMusicPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    const label = isMusicPlaying ? "Pause music" : "Play music";
    [playBtnMain, playBtnRooms].forEach(b => { if (b) { b.innerHTML = icon; b.setAttribute("aria-label", label); } });
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = isMusicPlaying ? "playing" : "paused"; } catch (e) { /* ignore */ } }
}

// Switch to a track at once (no fade): first track, after an error, or while paused.
function loadTrack(index, play) {
    finishCrossfade();
    currentTrackIndex = index;
    const el = activeEl(), other = el === audio1 ? audio2 : audio1;
    other.pause();
    el.src = playlist[index].url;
    el.volume = targetVolume();
    showTrack(index);
    if (play) safePlay(el);
}

function attemptAutoplay() {
    const el = activeEl();
    el.volume = targetVolume();
    const p = el.play();
    if (p !== undefined) {
        p.then(() => {
            isMusicPlaying = true; userPausedMusic = false;
            syncPlayPauseUI(); initAudio();
        }).catch(() => {
            // Browsers block sound until the person interacts. Start on the first click anywhere, unless they paused on purpose.
            document.body.addEventListener('click', function startAutoplay() {
                if (!isMusicPlaying && !userPausedMusic && playlist.length) toggleMainPlay();
            }, { once: true });
        });
    }
}

function toggleMainPlay() {
    if (!playlist.length) return;
    initAudio(); if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    const current = activeEl();
    if (isMusicPlaying) {
        current.pause(); isMusicPlaying = false; userPausedMusic = true;
        if (isCrossfading) finishCrossfade();
    } else {
        if (consecutiveTrackErrors >= 3 && !current.src) loadTrack(currentTrackIndex, false);
        consecutiveTrackErrors = 0;
        current.volume = targetVolume();
        isMusicPlaying = true; userPausedMusic = false;
        safePlay(current);
    }
    syncPlayPauseUI();
}

function muteForSpeech() {
    if (typeof ytDuck === 'function') ytDuck(true);
    if (isMusicPlaying && !userPausedMusic) {
        isTemporarilyMuted = true;
        audio1.volume = 0; audio2.volume = 0;
    }
}

function unmuteAfterSpeech() {
    if (typeof ytDuck === 'function') ytDuck(false);
    if (isMusicPlaying && !userPausedMusic && isTemporarilyMuted) {
        isTemporarilyMuted = false;
        activeEl().volume = targetVolume();
    }
}

function finishCrossfade() {
    if (!isCrossfading || !fadeState) { isCrossfading = false; return; }
    clearInterval(fadeInterval); fadeInterval = null;
    const { out, inn } = fadeState; fadeState = null;
    out.volume = 0; out.pause();
    inn.volume = targetVolume();
    activeAudio = inn === audio1 ? 1 : 2;
    isCrossfading = false;
}

function crossfadeTrack(index) {
    if (!playlist[index]) return;
    if (isCrossfading) finishCrossfade();                                   // a quick second tap must never be ignored
    currentTrackIndex = index;
    if (!isMusicPlaying) { loadTrack(index, false); return; }               // paused: just cue the track
    initAudio(); if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    showTrack(index);

    const out = activeEl(), inn = out === audio1 ? audio2 : audio1;
    inn.src = playlist[index].url;
    inn.volume = 0;
    safePlay(inn);
    isCrossfading = true; fadeState = { out, inn };

    const steps = 20, stepTime = 1500 / steps;
    let tick = 0;
    fadeInterval = setInterval(() => {
        tick++;
        const goal = targetVolume(), fadeStep = Math.max(goal, 0.01) / steps;
        out.volume = Math.max(0, out.volume - fadeStep);
        inn.volume = isTemporarilyMuted ? 0 : Math.min(goal, inn.volume + fadeStep);
        if (tick >= steps + 2) finishCrossfade();                          // always ends, even if the new track is slow to start
    }, stepTime);
}

function nextTrack() { if (!playlist.length) return; crossfadeTrack(currentTrackIndex + 1 >= playlist.length ? 0 : currentTrackIndex + 1); }
function prevTrack() { if (!playlist.length) return; crossfadeTrack(currentTrackIndex - 1 < 0 ? playlist.length - 1 : currentTrackIndex - 1); }

// A track that cannot load (dead link, offline, blocked) is skipped. After a few failures in a row we stop and say so.
function onTrackError(el) {
    if (!el.getAttribute("src") || (el !== activeEl() && !isCrossfading)) return;
    consecutiveTrackErrors++;
    console.warn("Music track failed to load, skipping:", el.src);
    if (!playlist.length || consecutiveTrackErrors > Math.min(5, playlist.length)) {
        isMusicPlaying = false; syncPlayPauseUI();
        setStatus_audio("/// MUSIC UNAVAILABLE (check your connection)");
        return;
    }
    const wasPlaying = isMusicPlaying;
    loadTrack(currentTrackIndex + 1 >= playlist.length ? 0 : currentTrackIndex + 1, wasPlaying);
}
function onTrackPlaying() { consecutiveTrackErrors = 0; }

audio1.addEventListener('ended', nextTrack);
audio2.addEventListener('ended', nextTrack);
[audio1, audio2].forEach(el => { el.addEventListener('error', () => onTrackError(el)); el.addEventListener('playing', onTrackPlaying); });

document.getElementById('next-btn').addEventListener('click', nextTrack);
document.getElementById('prev-btn').addEventListener('click', prevTrack);
playBtnMain.addEventListener('click', toggleMainPlay);
playBtnRooms.addEventListener('click', toggleMainPlay);

// Volume sliders (the widget and the Rooms player stay in step)
function applyVolumePercent(pct, save) {
    musicPercent = Math.max(0, Math.min(100, Math.round(pct)));
    volumeSliders.forEach(s => { if (String(s.value) !== String(musicPercent)) s.value = musicPercent; });
    if (!isCrossfading) activeEl().volume = targetVolume();
    if (save) { try { localStorage.setItem("mindsence_music_volume", String(musicPercent)); } catch (e) { /* ignore */ } }
}
volumeSliders.forEach(s => { s.value = musicPercent; s.addEventListener('input', () => applyVolumePercent(s.value, true)); });

// Lock-screen / keyboard media keys
if ('mediaSession' in navigator) {
    const handlers = { play: toggleMainPlay, pause: toggleMainPlay, previoustrack: prevTrack, nexttrack: nextTrack };
    Object.keys(handlers).forEach(a => { try { navigator.mediaSession.setActionHandler(a, () => { if (a === "play" && isMusicPlaying) return; if (a === "pause" && !isMusicPlaying) return; handlers[a](); }); } catch (e) { /* unsupported action */ } });
}

syncPlayPauseUI();                                    // never show a pause icon before anything is playing
loadPlaylist().then(({ list, label }) => {
    playlist = list; setStatus_audio(label);
    loadTrack(0, false);
    attemptAutoplay();
});
