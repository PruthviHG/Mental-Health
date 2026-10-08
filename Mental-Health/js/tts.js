// ==========================================
// --- LOCAL NEURAL TTS (EDGE-TTS) : STREAMING QUEUE ---
// Sentences are synthesized in parallel while the LLM is still writing,
// then played back-to-back, so speech starts almost immediately and keeps
// pace with the text on screen.
// ==========================================
const nexusVoicePlayer = new Audio();

let ttsQueue = [];          // [{ promise, url }] in playback order
let ttsPlaying = false;
let ttsEpoch = 0;           // bumps on every interruption: stale work is dropped
const TTS_MAX_PARALLEL = 3;
const ttsCache = new Map(); // text -> Promise<blob> (small LRU) so repeats are instant

function cleanForSpeech(text) {
    const ttsText = text
        .replace(/\[sigh\]/gi, ' haah... ')
        .replace(/\[hmm\]/gi, ' Hmm... ')
        .replace(/\[ahh\]/gi, ' Ahh... ')
        .replace(/\[oh\]/gi, ' Oh... ')
        .replace(/\[laugh\]/gi, ' heh... ')
        .replace(/\[.*?\]|\*.*?\*/g, '');
    return ttsText
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function resumeListening() {
    if (isLiveModeActive && window.location.protocol !== 'file:') {
        try { speechRecognition.start(); } catch (e) {}
    }
}

function fetchTtsBlob(text, signal) {
    if (ttsCache.has(text)) return ttsCache.get(text);
    const p = fetch(`${LOCAL_BACKEND_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ text: text.slice(0, 900) })
    }).then(r => {
        if (!r.ok) throw new Error('TTS request failed');
        return r.blob();
    });
    ttsCache.set(text, p);
    if (ttsCache.size > 30) ttsCache.delete(ttsCache.keys().next().value);
    p.catch(() => ttsCache.delete(text));
    return p;
}

// Queue one chunk of text (usually one sentence). Starts fetching right away.
async function playLocalVoice(text) {
    const cleanText = cleanForSpeech(text || '');
    if (!cleanText) {
        if (!ttsPlaying && ttsQueue.length === 0) resumeListening();
        return;
    }
    if (!ttsAbortController || ttsAbortController.signal.aborted) ttsAbortController = new AbortController();

    muteForSpeech();
    const epoch = ttsEpoch;
    const item = { promise: fetchTtsBlob(cleanText, ttsAbortController.signal), epoch };
    ttsQueue.push(item);
    pumpTtsQueue();
}

async function pumpTtsQueue() {
    if (ttsPlaying) return;
    ttsPlaying = true;
    const epoch = ttsEpoch;
    try {
        while (ttsQueue.length && epoch === ttsEpoch) {
            const item = ttsQueue.shift();
            let blob;
            try { blob = await item.promise; } catch (e) {
                if (e.name !== 'AbortError') console.error('Local TTS Error:', e);
                continue;               // skip a failed sentence, keep talking
            }
            if (epoch !== ttsEpoch) break;
            await playBlob(blob, epoch);
        }
    } finally {
        if (epoch === ttsEpoch) {       // finished naturally (not interrupted)
            ttsPlaying = false;
            unmuteAfterSpeech();
            resumeListening();
        } else {
            ttsPlaying = false;
            // a newer queue may already be waiting
            if (ttsQueue.length) pumpTtsQueue();
        }
    }
}

function playBlob(blob, epoch) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const done = () => {
            nexusVoicePlayer.onended = nexusVoicePlayer.onerror = null;
            URL.revokeObjectURL(url);
            resolve();
        };
        nexusVoicePlayer.onended = done;
        nexusVoicePlayer.onerror = done;
        nexusVoicePlayer._cancel = done;
        nexusVoicePlayer.src = url;
        const pr = nexusVoicePlayer.play();
        if (pr && pr.catch) pr.catch(done);
    });
}

// Called by stopAI(): drop everything queued and silence the player.
function cancelSpeech() {
    ttsEpoch++;
    ttsQueue = [];
    try { nexusVoicePlayer.pause(); } catch (e) {}
    try { nexusVoicePlayer.currentTime = 0; } catch (e) {}
    if (typeof nexusVoicePlayer._cancel === 'function') nexusVoicePlayer._cancel();
    nexusVoicePlayer._cancel = null;
    ttsPlaying = false;
}

// Splits streamed text into sentences as it arrives and speaks each one early.
function createSpeechStreamer() {
    let spokenUpTo = 0;
    const END = /[.!?…]+["')\]]*\s|\n/g;
    return {
        feed(raw) {
            END.lastIndex = spokenUpTo;
            let m, cutAt = -1;
            while ((m = END.exec(raw)) !== null) cutAt = m.index + m[0].length;
            if (cutAt > spokenUpTo) {
                const piece = raw.slice(spokenUpTo, cutAt);
                spokenUpTo = cutAt;
                playLocalVoice(piece);
            }
        },
        finish(raw) {
            const rest = raw.slice(spokenUpTo);
            spokenUpTo = raw.length;
            if (rest.trim()) playLocalVoice(rest);
        }
    };
}
