// Sentence-streaming TTS: speech must start after the first sentence, in order, and be cancellable.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setup() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'outside-only', url: 'http://localhost:8000/' });
    const w = dom.window;
    const requested = [], played = [];
    w.AbortController = AbortController;
    w.URL.createObjectURL = (b) => 'blob:' + (b.__t || 'x');
    w.URL.revokeObjectURL = () => {};
    w.Audio = class {
        constructor() { this.paused = true; this.currentTime = 0; }
        pause() { this.paused = true; }
        play() { this.paused = false; played.push(this.src); setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); }
    };
    w.fetch = (url, opts) => {
        const text = JSON.parse(opts.body).text;
        requested.push(text);
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => resolve({ ok: true, blob: async () => ({ __t: text }) }), 10);
            opts.signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
        });
    };
    const ctx = dom.getInternalVMContext();
    const run = (code) => new vm.Script(code).runInContext(ctx);
    run('let ttsAbortController = null; let isLiveModeActive = false; let speechRecognition = null; var __mute = 0, __unmute = 0; function muteForSpeech(){__mute++} function unmuteAfterSpeech(){__unmute++}');
    run(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'));
    run(fs.readFileSync(path.join(ROOT, 'js', 'tts.js'), 'utf8'));
    return { w, run, requested, played };
}

test('starts speaking after the first sentence, before the reply is finished', async () => {
    const { w, run, requested, played } = setup();
    try {
        run('beginSpeechStream()');
        run('feedSpeech("[sigh] Hello there, my friend. How are")');   // reply still streaming
        assert.strictEqual(requested.length, 1);
        assert.match(requested[0], /^haah\.\.\. Hello there, my friend\.$/);   // cue converted, only the finished sentence sent
        await sleep(60);
        assert.ok(played.length >= 1, 'first sentence is already playing');

        run('feedSpeech("[sigh] Hello there, my friend. How are you doing today? I am right here")');
        run('endSpeechStream("[sigh] Hello there, my friend. How are you doing today? I am right here")');
        await sleep(150);
        assert.deepStrictEqual(requested.slice(1).join(' '), 'How are you doing today? I am right here');
        assert.strictEqual(played.length, requested.length);
        assert.strictEqual(w.eval('__unmute'), 1);                    // music restored exactly once at the end
    } finally { w.close(); }
});

test('stopSpeech cancels pending audio and restores the music', async () => {
    const { w, run, requested, played } = setup();
    try {
        run('playLocalVoice("This is a fairly long sentence for testing. And here is another sentence that follows it.")');
        assert.ok(requested.length >= 1);
        run('stopSpeech()');
        await sleep(80);
        assert.strictEqual(played.length, 0, 'nothing plays after stop');
        assert.strictEqual(w.eval('__unmute'), 1);
    } finally { w.close(); }
});

test('emoji-only text is not sent to the TTS server', async () => {
    const { w, run, requested } = setup();
    try {
        run('playLocalVoice("🤍 [sigh]")');
        await sleep(30);
        assert.ok(requested.every(t => !/🤍/.test(t)));
    } finally { w.close(); }
});
