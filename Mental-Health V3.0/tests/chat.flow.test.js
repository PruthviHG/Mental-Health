// Integration test: loads the real index.html + the chat-related scripts in jsdom
// with stubbed network/audio, then drives the UI like a user.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = ['config', 'locales', 'locales2', 'i18n', 'core', 'safety', 'voice', 'simple', 'tts', 'llm', 'chat', 'mime'];

// /chat streams plain UTF-8 text. Split the bytes mid-way on purpose (this can cut a multi-byte character in
// half) to prove the client decodes across chunk boundaries.
function textChunks(tokens) {
    const bytes = Buffer.from(tokens.join(''), 'utf8');
    const mid = Math.floor(bytes.length / 2) + 1;
    return [bytes.subarray(0, mid), bytes.subarray(mid)];
}

function setup(replyTokens, opts = {}) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:8000/' });
    const w = dom.window;
    const calls = [];
    const enc = new TextEncoder();

    w.TextDecoder = TextDecoder;
    w.Audio = class { constructor() { this.paused = true; this.src = ''; } pause() {} play() { return Promise.resolve(); } };
    w.Element.prototype.scrollTo = function () {};
    w.fetch = async (url, init = {}) => {
        calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
        if (String(url).endsWith('/chat')) {
            if (opts.chatStatus) return { ok: false, status: opts.chatStatus, json: async () => ({ error: 'no_llm' }) };
            const chunks = textChunks(replyTokens);
            let i = 0;
            return { ok: true, status: 200, body: { getReader: () => ({ read: async () => i < chunks.length ? { value: chunks[i++], done: false } : { done: true } }) } };
        }
        return { ok: false, json: async () => ({}) };   // /health, /tts, ...
    };

    const ctx = dom.getInternalVMContext();
    for (const name of SCRIPTS) {
        new vm.Script(fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8'), { filename: `${name}.js` }).runInContext(ctx);
    }
    // Voice output is out of scope here
    w.eval('function muteForSpeech(){}; function unmuteAfterSpeech(){}; var __spoken = []; playLocalVoice = (t) => { __spoken.push(t); }; beginSpeechStream = () => {}; feedSpeech = () => {}; endSpeechStream = (t) => { __spoken.push(t); };');
    return { w, calls };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function closeAfter(w) { w.close(); }

async function send(w, text) {
    const input = w.document.getElementById('messageInput');
    input.value = text;
    w.document.getElementById('sendButton').click();
    await sleep(80);
}

test('streams a reply, hides vocal cues, and keeps conversation history', async () => {
    const { w, calls } = setup(['[sigh] I ', 'hear you', '. ', 'Want to ', 'talk?']);
    try {
    await send(w, 'rough day at college');

    const aiTexts = [...w.document.querySelectorAll('#chatbox .ai-text')].map(e => e.textContent);
    const last = aiTexts[aiTexts.length - 1];
    assert.strictEqual(last, 'I hear you. Want to talk?');            // cue stripped, stream reassembled across split chunks

    await send(w, 'it was about my exams');
    const chatCalls = calls.filter(c => c.url.endsWith('/chat'));
    const second = chatCalls[1].body.messages;
    assert.deepStrictEqual(second.map(m => m.role), ['user', 'assistant', 'user']);   // memory works; no system prompt leaves the browser
    assert.match(second[0].content, /rough day/);
    assert.match(second[1].content, /I hear you/);
    assert.strictEqual(chatCalls[1].body.context.lang, 'en');
    } finally { w.close(); }
});

test('crisis messages bypass the LLM and show helplines', async () => {
    const { w, calls } = setup(['should not be used']);
    try {
    await send(w, "I don't want to live anymore");

    assert.strictEqual(calls.filter(c => c.url.endsWith('/chat')).length, 0);
    const bubble = w.document.querySelector('.crisis-bubble');
    assert.ok(bubble, 'crisis bubble rendered');
    assert.match(bubble.textContent, /14416/);
    assert.match(bubble.textContent, /988/);

    // Follow-up goes to the LLM, but in care mode (no jokes)
    await send(w, 'i feel so alone');
    const chat = calls.filter(c => c.url.endsWith('/chat')).pop();
    assert.strictEqual(chat.body.context.crisis, true);                // server adds the "no jokes" instruction
    } finally { w.close(); }
});

test('typed messages never include stale voice-emotion text', async () => {
    const { w, calls } = setup(['ok']);
    try {
    await send(w, 'hello there');
    const chat = calls.find(c => c.url.endsWith('/chat'));
    assert.strictEqual(chat.body.context.emotion, undefined);
    } finally { w.close(); }
});

test('a fresh, confident voice emotion is passed to the model', async () => {
    const { w, calls } = setup(['ok']);
    try {
    w.eval("lastEmotion = { label: 'sad', confidence: 0.82, scores: {}, ts: Date.now() };");
    await send(w, 'hello there');
    const chat = calls.find(c => c.url.endsWith('/chat'));
    assert.deepStrictEqual(chat.body.context.emotion, { label: 'sad', confidence: 0.82 });
    } finally { w.close(); }
});

test('MIME popup chats in a small panel, mirrors the main chat, and never shows the main UI', async () => {
    const { w, calls } = setup(['[hmm] Hi ', 'from the room']);
    try {
        const doc = w.document;
        const mimeBtn = [...doc.querySelectorAll('#rooms-video-view button')].find(b => /MIME/.test(b.textContent));
        const panel = doc.querySelector('.mime-popup');
        assert.ok(mimeBtn && panel);
        assert.strictEqual(panel.style.display, 'none');

        mimeBtn.click();
        assert.strictEqual(panel.style.display, 'flex');

        const input = panel.querySelector('.mime-input');
        input.value = 'hello from the room';
        panel.querySelector('.mime-send').click();
        await sleep(80);

        const miniAi = [...panel.querySelectorAll('.ai-text')].pop().textContent;
        const mainAi = [...doc.querySelectorAll('#chatbox .ai-text')].pop().textContent;
        assert.strictEqual(miniAi, 'Hi from the room');
        assert.strictEqual(mainAi, 'Hi from the room');
        assert.ok(panel.textContent.includes('hello from the room'));
        assert.notStrictEqual(doc.getElementById('main-ui').style.opacity, '1');   // main UI was not re-shown/touched
        assert.strictEqual(calls.filter(c => c.url.endsWith('/chat')).length, 1);

        mimeBtn.click();                                            // close
        assert.strictEqual(panel.style.display, 'none');
        assert.strictEqual(w.eval('mimeBox'), null);
    } finally { w.close(); }
});

test('Hindi reply streams intact even when a byte chunk splits a character', async () => {
    const { w, calls } = setup(['नमस्ते ', 'दोस्त, ', 'मैं यहीं हूँ।']);
    try {
        await send(w, 'मुझे बहुत अकेलापन लग रहा है');
        const last = [...w.document.querySelectorAll('#chatbox .ai-text')].pop().textContent;
        assert.strictEqual(last, 'नमस्ते दोस्त, मैं यहीं हूँ।');
        assert.strictEqual(calls.find(c => c.url.endsWith('/chat')).body.context.lang, 'hi');   // auto-detected
    } finally { w.close(); }
});

test('a crisis message in Hindi gets the Hindi safety text and never reaches the model', async () => {
    const { w, calls } = setup(['should not be used']);
    try {
        await send(w, 'मैं मरना चाहता हूँ');
        assert.strictEqual(calls.filter(c => c.url.endsWith('/chat')).length, 0);
        const bubble = w.document.querySelector('.crisis-bubble');
        assert.ok(bubble);
        assert.match(bubble.textContent, /अकेले नहीं उठाना/);
        assert.match(bubble.textContent, /14416/);
    } finally { w.close(); }
});

test('language picker forces the conversation language', async () => {
    const { w, calls } = setup(['ok']);
    try {
        const sel = w.document.getElementById('lang-select');
        sel.value = 'kn';
        sel.dispatchEvent(new w.Event('change'));
        assert.strictEqual(w.document.documentElement.lang, 'kn');
        assert.match(w.document.getElementById('messageInput').placeholder, /ಬರೆಯಿರಿ/);
        await send(w, 'hello');                                   // English text, but Kannada was chosen
        assert.strictEqual(calls.find(c => c.url.endsWith('/chat')).body.context.lang, 'kn');
    } finally { w.close(); }
});

test('no model configured: simple mode answers instead of showing an error, and says so once', async () => {
    const { w } = setup(['unused'], { chatStatus: 503 });
    try {
        await send(w, 'I feel so alone');
        await sleep(600);                                          // simple mode types the reply out
        let texts = [...w.document.querySelectorAll('#chatbox .ai-text')].map(e => e.textContent);
        assert.match(texts[texts.length - 1], /simple mode/i);
        assert.doesNotMatch(texts[texts.length - 1], /\[/);       // no red error text
        await send(w, 'it is a rough week');
        await sleep(400);
        texts = [...w.document.querySelectorAll('#chatbox .ai-text')].map(e => e.textContent);
        assert.doesNotMatch(texts[texts.length - 1], /simple mode/i);   // the note is shown only once
    } finally { w.close(); }
});
