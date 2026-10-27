// Speech must start after the FIRST sentence in every supported script, not after the whole reply.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function setup(convLang) {
    const requested = [];
    const ctx = vm.createContext({
        console, setTimeout, clearTimeout, AbortController, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
        Audio: class { constructor() { this.paused = true; this.currentTime = 0; } pause() {} play() { return Promise.resolve(); } },
        fetch: (url, opts) => { const b = JSON.parse(opts.body); requested.push(b); return new Promise(() => {}); }   // never resolves: we only count requests
    });
    const run = (code) => vm.runInContext(code, ctx);
    run(`let ttsAbortController = null; let isLiveModeActive = false; let speechRecognition = null; function muteForSpeech(){} function unmuteAfterSpeech(){};`);
    for (const n of ['config', 'locales', 'locales2', 'i18n']) run(fs.readFileSync(path.join(ROOT, 'js', `${n}.js`), 'utf8').replace(/^const LOCALES/m, 'var LOCALES'));
    run(`convLang = ${JSON.stringify(convLang)}; langPref = "auto";`);
    run(fs.readFileSync(path.join(ROOT, 'js', 'tts.js'), 'utf8'));
    return { run, requested };
}

// Stream the reply a few characters at a time and report how much had arrived when the FIRST speech request went out.
function charsBeforeFirstSpeech(lang, reply, step = 3) {
    const { run, requested } = setup(lang);
    run('beginSpeechStream()');
    for (let i = step; i <= reply.length; i += step) {
        run(`feedSpeech(${JSON.stringify(reply.slice(0, i))})`);
        if (requested.length) return { chars: i, total: reply.length, requested };
    }
    return { chars: Infinity, total: reply.length, requested };
}

const SAMPLES = {
    en: "I hear you, and I'm so sorry today feels this heavy. You don't have to explain it perfectly. What has been the hardest part?",
    hi: "मैं तुम्हारी बात सुन रहा हूँ, और मुझे बहुत अफ़सोस है कि आज इतना भारी लग रहा है। तुम्हें इसे पूरी तरह समझाने की ज़रूरत नहीं है। सबसे मुश्किल क्या रहा?",
    zh: "我在听你说，今天觉得这么沉重，我很难过。你不需要把它解释得很完美。最难的部分是什么？",
    ja: "話してくれてありがとう。今日はとても重く感じるんですね。うまく説明しなくて大丈夫です。いちばんつらいのは何ですか？",
    ar: "أنا أسمعك، ويؤسفني أن اليوم ثقيل إلى هذا الحد. لست مضطرًا لشرحه بشكل مثالي. ما أصعب جزء؟",
    es: "Te escucho, y lamento que hoy se sienta tan pesado. No tienes que explicarlo perfecto. ¿Qué ha sido lo más difícil?",
    kn: "ನಾನು ನಿನ್ನ ಮಾತು ಕೇಳುತ್ತಿದ್ದೇನೆ, ಇವತ್ತು ಇಷ್ಟು ಭಾರವಾಗಿದೆ ಅನ್ನುವುದಕ್ಕೆ ನನಗೆ ಬೇಸರವಿದೆ. ನೀನು ಎಲ್ಲವನ್ನೂ ಪರಿಪೂರ್ಣವಾಗಿ ವಿವರಿಸಬೇಕಿಲ್ಲ. ಅತ್ಯಂತ ಕಷ್ಟ ಯಾವುದು ಅನಿಸಿತು?"
};

for (const [lang, reply] of Object.entries(SAMPLES)) {
    test(`${lang}: speech starts after the first sentence, not after the whole reply`, () => {
        const r = charsBeforeFirstSpeech(lang, reply);
        assert.ok(r.requested.length >= 1, `no speech request was made at all for ${lang}`);
        assert.ok(r.chars < r.total * 0.75, `${lang}: speech only started after ${r.chars} of ${r.total} characters`);
    });
}

test('a long reply with no punctuation still starts speaking early (comma / space cut)', () => {
    const run = "ನಾನು ನಿನ್ನ ಜೊತೆ ಇದ್ದೇನೆ ಮತ್ತು ನೀನು ಹೇಳುವುದನ್ನು ಕೇಳುತ್ತಿದ್ದೇನೆ ನಿಧಾನವಾಗಿ ಉಸಿರಾಡು ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ ಯಾವ ಆತುರವೂ ಇಲ್ಲ ನಿನ್ನ ಸಮಯ ತೆಗೆದುಕೋ ನಿನಗೆ ಬೇಕಾದಷ್ಟು";
    const r = charsBeforeFirstSpeech('kn', run);
    assert.ok(r.chars < r.total, 'never started speaking before the end');
});

test('the voice matches the text: English reply to a Hindi chat gets the English voice, Hindi text the Hindi voice', () => {
    const { run } = setup('hi');
    assert.strictEqual(run('voiceLangFor("I am here with you, take your time.")'), 'en');
    assert.strictEqual(run('voiceLangFor("मैं यहीं हूँ, अपना समय लो।")'), 'hi');
    const s2 = setup('en');
    assert.strictEqual(s2.run('voiceLangFor("estoy aquí contigo y no tengo prisa")'), 'es');
    assert.strictEqual(s2.run('voiceLangFor("我在这里陪着你")'), 'zh');
});

test('Latin sentences are not cut at decimals or abbreviations', () => {
    const { run } = setup('en');
    assert.strictEqual(run('findSpeechCut("It is 3.5 hours away")'), 0);
    assert.ok(run('findSpeechCut("I am here. Tell me more")') > 0);
});

test('the first chunk may end at a comma, so speech starts before the first sentence is finished', () => {
    const reply = "I hear you and I'm so sorry today feels this heavy, and you don't have to explain it perfectly for me to understand. What has been the hardest part?";
    const r = charsBeforeFirstSpeech('en', reply);
    const firstSentenceEnd = reply.indexOf('understand.') + 11;
    assert.ok(r.chars < firstSentenceEnd - 20, `speech started at ${r.chars}, the sentence ends at ${firstSentenceEnd}`);
    const first = r.requested[0].text;
    assert.ok(first.endsWith(','), `first clip should end at the comma: "${first}"`);
    assert.ok(first.length >= 24, first);
});

test('a short opening like "Hmm, okay" is not spoken alone', () => {
    const { run, requested } = setup('en');
    run('beginSpeechStream()');
    run('feedSpeech("Hmm, okay ")');
    assert.strictEqual(requested.length, 0);
});

test('later chunks still wait for sentence ends (only the first is allowed to stop at a comma)', () => {
    const { run, requested } = setup('en');
    run('beginSpeechStream()');
    run('feedSpeech("That makes sense. ")');
    const n = requested.length;
    run('feedSpeech("That makes sense. And honestly, it is perfectly okay to feel tired and a little lost, really ")');
    assert.strictEqual(requested.length, n);
});

test('silent edges of a clip are trimmed, but never a soft start or all of a quiet clip', () => {
    const { run } = setup('en');
    const sr = 24000;
    const range = (build) => JSON.parse(run(`(() => { const a = new Float32Array(${sr}); ${build}; return JSON.stringify(audibleRange(a, ${sr})); })()`));
    const [a, b] = range('for (let i = 4800; i < 16000; i++) a[i] = 0.3');
    assert.ok(a > 4000 && a < 4800 && b > 16000 && b < 17200, `${a},${b}`);                 // trimmed to the sound, small pads kept
    assert.deepStrictEqual(range('/* silence */'), [0, sr]);                                  // all quiet: untouched
    const [c] = range('for (let i = 20000; i < 23000; i++) a[i] = 0.3');
    assert.ok(c <= sr * 0.4, `never trims more than 0.4 s from the start, got ${c}`);
});
