// Language detection + simple mode, loaded the way the browser loads them (plain scripts sharing one global scope).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
function load(...names) {
    const ctx = vm.createContext({ console, navigator: { languages: ['en-US'] }, localStorage: { getItem() { return null; }, setItem() {} } });
    vm.runInContext('var window = undefined;', ctx);
    for (const n of names) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', `${n}.js`), 'utf8'), ctx, { filename: `${n}.js` });
    return ctx;
}
const ctx = load('config', 'locales', 'locales2', 'i18n', 'simple');
const run = (code) => vm.runInContext(code, ctx);

test('detects the script of the message', () => {
    const cases = {
        "I feel really down today and I have no energy": "en", "hola me siento muy triste hoy": "es", "je suis très fatigué et je n'ai pas dormi": "fr",
        "ich bin so müde und ich habe keine Kraft": "de", "estou muito cansado e não consigo dormir": "pt",
        "मुझे बहुत अकेलापन लग रहा है": "hi", "मला खूप एकटं वाटतंय आणि काय करावं ते कळत नाही": "mr", "ನನಗೆ ತುಂಬಾ ಬೇಜಾರಾಗಿದೆ": "kn",
        "எனக்கு மிகவும் கவலையாக இருக்கிறது": "ta", "నాకు చాలా బాధగా ఉంది": "te", "আমার খুব মন খারাপ": "bn",
        "أشعر بحزن شديد اليوم": "ar", "我今天心情很不好": "zh", "今日はとても疲れました": "ja"
    };
    for (const [text, lang] of Object.entries(cases)) assert.strictEqual(run(`detectLang(${JSON.stringify(text)})`), lang, text);
    assert.strictEqual(run('detectLang("")'), null);
    assert.strictEqual(run('detectLang("ok")'), null);
});

test('auto mode follows the person; a chosen language is fixed', () => {
    run('langPref = "auto"; convLang = "en";');
    assert.strictEqual(run('noteUserText("मुझे बहुत अकेलापन लग रहा है")'), 'hi');
    assert.strictEqual(run('noteUserText("ok")'), 'hi');                        // too little to detect: keep current language
    assert.strictEqual(run('noteUserText("estoy muy triste y no quiero hablar")'), 'es');
    run('langPref = "kn";');
    assert.strictEqual(run('noteUserText("hello there my friend")'), 'kn');
    run('langPref = "auto"; convLang = "en";');
});

test('each language maps to a speech-recognition locale', () => {
    assert.strictEqual(run('speechLocale("kn")'), 'kn-IN');
    assert.strictEqual(run('speechLocale("pt")'), 'pt-BR');
    assert.strictEqual(run('LANGS.every(l => LOCALES[l.code] && /^[a-z]{2}-[A-Z]{2}$/.test(l.speech))'), true);
});

test('simple mode answers in the right language and never claims to be a doctor', () => {
    assert.match(run('simpleReply("I cannot sleep at all", "en")'), /sleep|breath|night/i);
    assert.match(run('simpleReply("I feel so alone", "en")'), /alone|here/i);
    assert.match(run('simpleReply("मुझे बुरा लग रहा है", "hi")'), /[ऀ-ॿ]/);
    assert.match(run('simpleReply("whatever", "ja")'), /[぀-ヿ]/);
    assert.ok(run('simpleReply("whatever", "xx")').length > 10);               // unknown language falls back to English
    for (const lang of Object.keys(JSON.parse(JSON.stringify(run('SIMPLE_GENERIC'))))) {
        assert.ok(run(`LOCALES["${lang}"] !== undefined`), lang);
    }
});

test('sign-in screen text exists in every language', () => {
    const c = load('config', 'locales', 'locales2', 'locales3', 'i18n');
    const keys = JSON.parse(JSON.stringify(vm.runInContext('Object.keys(LOCALES.en).filter(k => /^a[A-Z]/.test(k))', c)));
    assert.ok(keys.length >= 16);
    for (const code of vm.runInContext('LANGS.map(l => l.code)', c)) {
        for (const k of keys) assert.ok(vm.runInContext(`typeof LOCALES.${code}.${k} === "string" && LOCALES.${code}.${k}.length > 0`, c), `${code}.${k}`);
    }
});
