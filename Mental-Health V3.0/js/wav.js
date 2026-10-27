// ==========================================
// --- AUDIO -> 16 kHz mono WAV (done in the browser) ---
// MediaRecorder produces WebM/Opus (or MP4), which Python's soundfile/librosa cannot
// read without ffmpeg. Converting here means the backend always receives a plain WAV.
// ==========================================
const WAV_RATE = 16000;
const WAV_MAX_SECONDS = 20;

function encodeWav(samples, rate) {
    const n = Math.min(samples.length, rate * WAV_MAX_SECONDS);
    const buffer = new ArrayBuffer(44 + n * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

    writeStr(0, 'RIFF');  view.setUint32(4, 36 + n * 2, true);
    writeStr(8, 'WAVE');  writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);  view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);   view.setUint32(24, rate, true);     // mono, sample rate
    view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);   // byte rate, block align
    view.setUint16(34, 16, true);  writeStr(36, 'data');
    view.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

async function blobToWav16k(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !Offline) throw new Error("Web Audio not available");
    const ctx = new AC();
    try {
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        const length = Math.max(1, Math.ceil(decoded.duration * WAV_RATE));
        const off = new Offline(1, length, WAV_RATE);          // 1 channel = automatic mono downmix + resample
        const src = off.createBufferSource();
        src.buffer = decoded; src.connect(off.destination); src.start();
        const rendered = await off.startRendering();
        return new Blob([encodeWav(rendered.getChannelData(0), WAV_RATE)], { type: 'audio/wav' });
    } finally {
        ctx.close();
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { encodeWav };
