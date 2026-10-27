// ==========================================
// --- NEURAL TTS WITH SENTENCE STREAMING (low latency) ---
// Speech starts after the FIRST clause. While clip N plays, clip N+1 is already being synthesized and decoded.
// Clips are decoded in the browser, their silent edges trimmed, and scheduled back to back on one Web Audio
// timeline: no gap between sentences and no per-clip media start-up delay. If Web Audio is unavailable the
// old <audio> element path plays the same clips, so speech never breaks.
// ==========================================
const nexusVoicePlayer = new Audio();

const speech = {
    session: 0,          // bumped on every stop/start; stale loops and fetches bail out
    loopSession: -1,
    queue: [],           // [{ text, blob: Promise<Blob> }]
    consumed: 0,         // characters of the raw reply already turned into chunks
    acc: "",             // sentences waiting to reach the minimum chunk size
    chunkCount: 0,
    ended: false,        // no more text is coming for this reply
    wake: null,          // resolver for "new item or end arrived"
    stopWaiter: null,    // resolver for the clip that is currently playing
    muted: false,        // ambient music is ducked while we speak
    controllers: new Set(),
    sources: new Set(),  // Web Audio clips scheduled or playing
    nextStart: 0,        // AudioContext time at which the next clip should begin (gapless)
    active: false,       // true from the first queued clip until the reply has been spoken (or stopped)
    drainResolve: null   // resolver for "everything scheduled has finished"
};

const SPEECH_FIRST_CHUNK_MIN = 14;   // start talking as soon as the first sentence is ready
const SPEECH_FIRST_CLAUSE_MIN = 24;  // ...or as soon as the first clause (up to a comma) is ready, if that is faster
const SPEECH_NEXT_CHUNK_MIN = 30;    // later chunks are merged a bit to avoid choppy speech

function _speechLang() { return (typeof convLang !== 'undefined') ? convLang : 'en'; }

// The voice must match the text it reads: a small model sometimes answers in English to a Hindi message, and an
// Indic voice reading English (or the reverse) sounds broken or stays silent.
const LATIN_LANGS = ['en', 'es', 'fr', 'de', 'pt'];
function voiceLangFor(text) {
    const conv = _speechLang();
    const latinOnly = !/[^\u0000-\u024F\s\p{P}\p{S}\p{N}]/u.test(text);
    if (latinOnly) {
        const d = (typeof detectLang === 'function') ? detectLang(text) : null;
        if (d && LATIN_LANGS.includes(d)) return d;
        return LATIN_LANGS.includes(conv) ? conv : 'en';
    }
    const d = (typeof detectLang === 'function') ? detectLang(text) : null;
    return d || conv;
}

function cleanForSpeech(text) {
    // English filler sounds only make sense in an English voice; other voices just skip the cues.
    const en = _speechLang() === 'en';
    if (!en) text = text.replace(/\[(sigh|hmm|ahh|oh|laugh)\]/gi, ' ');
    return text
        .replace(/\[sigh\]/gi, ' haah... ')
        .replace(/\[hmm\]/gi, ' Hmm... ')
        .replace(/\[ahh\]/gi, ' Ahh... ')
        .replace(/\[oh\]/gi, ' Oh... ')
        .replace(/\[laugh\]/gi, ' heh... ')
        .replace(/\[.*?\]|\*.*?\*/g, '')
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')   // emoji (incl. 🤍), keeps normal punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

function resumeListening() {
    if (typeof isLiveModeActive !== 'undefined' && isLiveModeActive && window.location.protocol !== 'file:') {
        clearTimeout(resumeListening.timer);
        resumeListening.timer = setTimeout(() => { try { if (typeof speechLocale === 'function') speechRecognition.lang = speechLocale(convLang); speechRecognition.start(); } catch (e) { /* already listening */ } }, 120);
    }
}

// How much faster than normal to ask the voice engine to speak: more when sentences are piling up behind the one playing.
function speechExtraRate() {
    const behind = speech.queue.length + (speech.sources.size ? 1 : 0);
    return Math.min(18, behind * 6);
}

function fetchSpeechBlob(text) {
    const ctrl = new AbortController();
    speech.controllers.add(ctrl);
    ttsAbortController = ctrl;          // kept for stopAI() compatibility
    return fetch(`${LOCAL_BACKEND_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({ text: text.slice(0, 900), lang: voiceLangFor(text), rate: speechExtraRate() })
    }).then(res => {
        if (res.status === 401 && typeof onUnauthenticated === "function") onUnauthenticated();
        if (!res.ok) throw new Error("TTS request failed");
        return res.blob();
    }).finally(() => speech.controllers.delete(ctrl));
}

// ----- Web Audio engine -----
let _speechCtx = null;
function speechAudioContext() {
    if (_speechCtx) return _speechCtx;
    const AC = (typeof AudioContext !== 'undefined' && AudioContext) || (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
    if (!AC) return null;
    try { _speechCtx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { _speechCtx = new AC(); } catch (e2) { _speechCtx = null; } }
    return _speechCtx;
}
// Browsers only let audio start after a click or key press. Do the unlock on the first one, so the first reply is not silent.
function unlockSpeechAudio() {
    const ctx = speechAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
if (typeof document !== 'undefined') {
    ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, unlockSpeechAudio, { passive: true }));
}

// Synthesized clips carry a little silence at both ends; played one after another that is an audible pause.
// Returns [startIndex, endIndex) of the audible part (keeps a short pad so soft starts and endings are not cut).
function audibleRange(samples, sampleRate) {
    const thr = 0.012, n = samples.length;
    let a = 0, b = n;
    while (a < n && Math.abs(samples[a]) < thr) a++;
    if (a === n) return [0, n];                                   // all quiet: leave it alone
    while (b > a && Math.abs(samples[b - 1]) < thr) b--;
    const padStart = Math.round(sampleRate * 0.012), padEnd = Math.round(sampleRate * 0.035), maxTrimStart = Math.round(sampleRate * 0.4);
    a = Math.min(Math.max(0, a - padStart), maxTrimStart);       // never trim more than 0.4 s from the start
    b = Math.min(n, b + padEnd);
    return [a, Math.max(b, a + 1)];
}

async function decodeSpeech(blob) {
    const ctx = speechAudioContext();
    if (!ctx || typeof ctx.decodeAudioData !== 'function') throw new Error('no web audio');
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const [a, b] = audibleRange(buf.getChannelData(0), buf.sampleRate);
    if (a === 0 && b >= buf.length) return buf;
    const out = ctx.createBuffer(buf.numberOfChannels, b - a, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(a, b), c);
    return out;
}

function _drainDone() {
    if (speech.sources.size === 0 && speech.drainResolve) { const r = speech.drainResolve; speech.drainResolve = null; r(); }
}
// Resolves when every scheduled clip has finished playing (or immediately if nothing is scheduled or speech was stopped).
function drainScheduled() {
    if (speech.sources.size === 0) return Promise.resolve();
    return new Promise(resolve => { speech.drainResolve = resolve; });
}

// The reply text streams in far faster than anyone can speak it. The voice engine speaks faster (up to ~+18%) when
// sentences are waiting, so voice and text finish closer together without changing the pitch.
function speechPace() { return 1; }     // speed is set by the voice engine (see speechExtraRate): playbackRate would change the pitch

// Put a decoded clip on the timeline right after the previous one. Returns false if the context cannot play right now.
async function scheduleBuffer(buf) {
    const ctx = speechAudioContext();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
        try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 250))]); } catch (e) { /* ignore */ }
        if (ctx.state !== 'running') return false;                 // still locked: caller uses the <audio> path
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const pace = speechPace();
    src.playbackRate.value = pace;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.015, speech.nextStart);
    speech.nextStart = startAt + buf.duration / pace;
    speech.sources.add(src);
    src.onended = () => { speech.sources.delete(src); try { src.disconnect(); } catch (e) { /* ignore */ } _drainDone(); };
    src.start(startAt);
    return true;
}

function enqueueSpeech(text) {
    const clean = cleanForSpeech(text);
    if (!clean) return;
    const item = { text: clean, blob: fetchSpeechBlob(clean) };
    item.blob.catch(() => { /* handled when the item is played */ });
    item.buffer = item.blob.then(decodeSpeech);                     // decode as soon as the audio arrives, off the critical path
    item.buffer.catch(() => { /* a decode problem falls back to the <audio> path */ });
    speech.queue.push(item);
    speech.chunkCount++;
    speech.active = true;
    if (speech.chunkCount === 1) { muteForSpeech(); speech.muted = true; }
    startSpeechLoop();
    if (speech.wake) speech.wake();
}

function playBlob(blob) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const done = () => {
            nexusVoicePlayer.onended = null; nexusVoicePlayer.onerror = null;
            speech.stopWaiter = null;
            URL.revokeObjectURL(url);
            resolve();
        };
        speech.stopWaiter = done;
        nexusVoicePlayer.onended = done;
        nexusVoicePlayer.onerror = done;
        nexusVoicePlayer.src = url;
        nexusVoicePlayer.playbackRate = speechPace();       // keeps pitch (preservesPitch is the default)
        const p = nexusVoicePlayer.play();
        if (p && p.catch) p.catch(done);
    });
}

// Fallback voice: the browser's own speech synthesis. Resolves true if it spoke, false if unavailable.
function speakWithBrowser(text) {
    return new Promise(resolve => {
        const synth = (typeof window !== 'undefined') && window.speechSynthesis;
        if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return resolve(false);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = (typeof speechLocale === 'function') ? speechLocale(voiceLangFor(text)) : 'en-US';
        u.rate = Math.min(1.3, 1.0 * speechPace());
        let started = false, finished = false;
        const done = (ok) => { if (finished) return; finished = true; clearTimeout(guard); speech.stopWaiter = null; resolve(ok); };
        // A browser without a voice for this language can stay silent forever: never let that block the queue.
        const guard = setTimeout(() => { try { synth.cancel(); } catch (e) { /* ignore */ } done(false); }, 4000 + text.length * 120);
        u.onstart = () => { started = true; };
        speech.stopWaiter = () => { try { synth.cancel(); } catch (e) { /* ignore */ } done(true); };
        u.onend = () => done(true);
        u.onerror = () => done(false);
        synth.speak(u);
    });
}

function startSpeechLoop() {
    if (speech.loopSession === speech.session) return;
    speech.loopSession = speech.session;
    const session = speech.session;
    (async () => {
        let failed = false;
        while (session === speech.session) {
            const item = speech.queue.shift();
            if (!item) {
                if (speech.ended) break;
                await new Promise(r => { speech.wake = r; });
                speech.wake = null;
                continue;
            }
            try {
                const blob = await item.blob;                      // server errors throw here -> browser voice below
                if (session !== speech.session) return;
                let buf = null;
                try { buf = await item.buffer; } catch (e) { buf = null; }
                if (session !== speech.session) return;
                if (!(buf && await scheduleBuffer(buf))) {         // Web Audio not available/unlocked: classic <audio> playback
                    await drainScheduled();
                    if (session !== speech.session) return;
                    await playBlob(blob);
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn("Server voice unavailable, using the browser's built-in voice:", err.message);
                if (session !== speech.session) return;
                await drainScheduled();                             // keep the order: finish what is already queued first
                if (session !== speech.session) return;
                speech.nextStart = 0;
                const spoke = await speakWithBrowser(item.text);     // works offline and for most languages
                if (!spoke) failed = true;           // no voice at all: skip this sentence, keep going
            }
        }
        if (session === speech.session) { await drainScheduled(); }
        if (session === speech.session) finishSpeech(failed);
    })();
}

function finishSpeech() {
    speech.active = false;
    speech.muted = false;
    unmuteAfterSpeech();
    resumeListening();
}

// Cancel everything: pending fetches, queued clips, the clip that is playing.
function stopSpeech() {
    speech.session++;
    speech.queue = [];
    speech.acc = ""; speech.consumed = 0; speech.chunkCount = 0;
    speech.ended = true; speech.active = false;
    speech.controllers.forEach(c => c.abort());
    speech.controllers.clear();
    if (speech.wake) speech.wake();
    if (speech.stopWaiter) speech.stopWaiter();
    speech.sources.forEach(src => { src.onended = null; try { src.stop(); } catch (e) { /* not started */ } try { src.disconnect(); } catch (e) { /* ignore */ } });
    speech.sources.clear(); speech.nextStart = 0;
    if (speech.drainResolve) { const r = speech.drainResolve; speech.drainResolve = null; r(); }
    if (!nexusVoicePlayer.paused) { nexusVoicePlayer.pause(); nexusVoicePlayer.currentTime = 0; }
    if (speech.muted) { speech.muted = false; unmuteAfterSpeech(); }   // never leave the music ducked
}

function beginSpeechStream() {
    stopSpeech();
    speech.ended = false;
}

// Call with the raw reply-so-far every time a token arrives.
// Sentence ends in every supported script: Latin . ! ? … | Devanagari/Bengali danda । ॥ | Arabic ؟ ۔ | CJK 。！？
// (CJK has no space after the mark, so it needs no lookahead). A long run with no mark at all is cut at a comma or
// space so speech still starts early instead of waiting for the whole reply.
const SPEECH_BOUNDARY = /[.!?\u2026\u0964\u0965\u061F\u06D4]+["')\]\u201D]*(?=\s)|[\u3002\uFF01\uFF1F\uFF1B]+[\u300D\u201D)]*|\n/g;
const SPEECH_RUNON_MAX = 90;
const SPEECH_CLAUSE = /[,;:\u3001\uFF0C\u060C\u061B]+["')\]\u201D]*(?=\s)|[\u3001\uFF0C]+|\s[\u2014\u2013-]\s/g;
function findSpeechCut(pending, first) {
    SPEECH_BOUNDARY.lastIndex = 0;
    let cut = 0, m;
    while ((m = SPEECH_BOUNDARY.exec(pending)) !== null) cut = m.index + m[0].length;
    if (!cut && first) {                                         // the very first chunk may stop at the first comma: speech starts sooner
        SPEECH_CLAUSE.lastIndex = 0;
        while ((m = SPEECH_CLAUSE.exec(pending)) !== null) {
            const end = m.index + m[0].length;
            if (cleanForSpeech(pending.slice(0, end)).length >= SPEECH_FIRST_CLAUSE_MIN) { cut = end; break; }
        }
    }
    if (!cut && pending.length > SPEECH_RUNON_MAX) {
        const soft = Math.max(pending.lastIndexOf(", "), pending.lastIndexOf("\u3001"), pending.lastIndexOf("\uFF0C"), pending.lastIndexOf("\u060C"), pending.lastIndexOf(" "));
        if (soft > 30) cut = soft + 1;
    }
    return cut;
}

function feedSpeech(raw) {
    if (speech.ended) return;
    const pending = raw.slice(speech.consumed);
    const cut = findSpeechCut(pending, speech.chunkCount === 0 && !speech.acc);
    if (!cut) return;

    speech.acc += pending.slice(0, cut);
    speech.consumed += cut;
    const min = speech.chunkCount === 0 ? SPEECH_FIRST_CHUNK_MIN : SPEECH_NEXT_CHUNK_MIN;
    if (cleanForSpeech(speech.acc).length >= min) {
        enqueueSpeech(speech.acc);
        speech.acc = "";
    }
}

// Call once the reply is complete: speaks whatever is left.
function endSpeechStream(raw) {
    if (speech.ended) return;
    speech.acc += raw.slice(speech.consumed);
    speech.consumed = raw.length;
    const rest = speech.acc; speech.acc = "";
    enqueueSpeech(rest);
    speech.ended = true;
    if (speech.chunkCount === 0) { finishSpeech(); return; }   // nothing speakable
    if (speech.wake) speech.wake();
}

// Resolves once nothing is being spoken (or after maxMs): lets a follow-up line wait its turn instead of cutting the reply off.
function whenSpeechIdle(maxMs = 25000) {
    return new Promise(resolve => {
        const t0 = Date.now();
        const tick = () => { if (!speech.active || Date.now() - t0 > maxMs) resolve(); else setTimeout(tick, 150); };
        tick();
    });
}

// Speak a complete message (idle check-ins, crisis message, ...)
function playLocalVoice(text) {
    beginSpeechStream();
    feedSpeech(text + " ");
    endSpeechStream(text);
}
