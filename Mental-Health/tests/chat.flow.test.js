// Integration test: loads the real index.html + the chat-related scripts in jsdom
// with stubbed network/audio, then drives the UI like a user.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = ['config', 'core', 'safety', 'voice', 'tts', 'llm', 'chat', 'mime'];

function ndjson(tokens) {
    const lines = tokens.map(t => JSON.stringify({ message: { role: 'assistant', content: t }, done: false }) + '\n');
    lines.push(JSON.stringify({ done: true }) + '\n');
    // Split mid-line on purpose to prove the stream parser buffers partial JSON.
    const joined = lines.join('');
    const mid = Math.floor(joined.length / 2);
    return [joined.slice(0, mid), joined.slice(mid)];
}

function setup(replyTokens) {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:8000/' });
    const w = dom.window;
    const calls = [];
    const enc = new TextEncoder();

    w.TextDecoder = TextDecoder;
    w.Audio = class { constructor() { this.paused = true; this.src = ''; } pause() {} play() { return Promise.resolve(); } };
    w.Element.prototype.scrollTo = function () {};
    w.fetch = async (url, opts = {}) => {
        calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
        if (String(url).endsWith('/api/chat')) {
            const body = JSON.parse(opts.body);
            if (body.messages.length === 0) return { ok: true, body: { getReader: () => ({ read: async () => ({ done: true }) }) } };
            const chunks = ndjson(replyTokens).map(c => enc.encode(c));
            let i = 0;
            return { ok: true, body: { getReader: () => ({ read: async () => i < chunks.length ? { value: chunks[i++], done: false } : { done: true } }) } };
        }
        return { ok: false, json: async () => ({}) };   // /health, /api/tags, /tts, ...
    };

    const ctx = dom.getInternalVMContext();
    for (const name of SCRIPTS) {
        new vm.Script(fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8'), { filename: `${name}.js` }).runInContext(ctx);
    }
    // Voice output is out of scope here
    w.eval('playLocalVoice = async () => {}; var __spoken = []; playLocalVoice = async (t) => { __spoken.push(t); };');
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
    const chatCalls = calls.filter(c => c.url.endsWith('/api/chat') && c.body.messages.length);
    const second = chatCalls[1].body.messages;
    assert.strictEqual(second[0].role, 'system');
    assert.deepStrictEqual(second.slice(1).map(m => m.role), ['user', 'assistant', 'user']);   // memory works
    assert.match(second[1].content, /rough day/);
    assert.match(second[2].content, /I hear you/);
    } finally { w.close(); }
});

test('crisis messages bypass the LLM and show helplines', async () => {
    const { w, calls } = setup(['should not be used']);
    try {
    await send(w, "I don't want to live anymore");

    assert.strictEqual(calls.filter(c => c.url.endsWith('/api/chat') && c.body.messages.length).length, 0);
    const bubble = w.document.querySelector('.crisis-bubble');
    assert.ok(bubble, 'crisis bubble rendered');
    assert.match(bubble.textContent, /14416/);
    assert.match(bubble.textContent, /988/);

    // Follow-up goes to the LLM, but in care mode (no jokes)
    await send(w, 'i feel so alone');
    const chat = calls.filter(c => c.url.endsWith('/api/chat') && c.body.messages.length).pop();
    assert.match(chat.body.messages[0].content, /No jokes or teasing/);
    } finally { w.close(); }
});

test('typed messages never include stale voice-emotion text', async () => {
    const { w, calls } = setup(['ok']);
    try {
    await send(w, 'hello there');
    const chat = calls.find(c => c.url.endsWith('/api/chat') && c.body.messages.length);
    assert.doesNotMatch(chat.body.messages[0].content, /Voice tone analysis/);
    } finally { w.close(); }
});

test('a fresh, confident voice emotion is passed to the model', async () => {
    const { w, calls } = setup(['ok']);
    try {
    w.eval("lastEmotion = { label: 'sad', confidence: 0.82, scores: {}, ts: Date.now() };");
    await send(w, 'hello there');
    const chat = calls.find(c => c.url.endsWith('/api/chat') && c.body.messages.length);
    assert.match(chat.body.messages[0].content, /sound sad \(82% confidence\)/);
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
        assert.strictEqual(calls.filter(c => c.url.endsWith('/api/chat') && c.body.messages.length).length, 1);

        mimeBtn.click();                                            // close
        assert.strictEqual(panel.style.display, 'none');
        assert.strictEqual(w.eval('mimeBox'), null);
    } finally { w.close(); }
});
