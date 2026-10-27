const test = require('node:test');
const assert = require('node:assert');
const { detectCrisis, HELPLINES, CRISIS_RESPONSE, buildCrisisResponse, crisisSpoken, helplinesFor } = require('../js/safety.js');
const { LOCALES } = require('../js/locales2.js');

test('detects direct self-harm and suicide statements', () => {
    [
        "I want to kill myself",
        "i don't want to live anymore",
        "I don’t want to be alive",          // typographic apostrophe
        "thinking about ending my life",
        "Sometimes I wish I was dead",
        "I'm suicidal",
        "I've been self harming",
        "there's no point in living",
        "everyone would be better off without me",
        "I can't go on",
        "I want to die",
        "i keep cutting myself"
    ].forEach(t => assert.ok(detectCrisis(t), `should flag: ${t}`));
});

test('does not flag ordinary or playful messages', () => {
    [
        "I'm so tired today",
        "I had a rough day at college",
        "this exam is killing me",
        "I want to kill you lol",
        "I cut myself shaving this morning",
        "I'm dying to see that movie",
        "can you recommend a lofi playlist",
        ""
    ].forEach(t => assert.ok(!detectCrisis(t), `should NOT flag: ${t}`));
});

test('crisis response includes helplines and emergency guidance', () => {
    assert.match(CRISIS_RESPONSE, /14416/);
    assert.match(CRISIS_RESPONSE, /988/);
    assert.ok(HELPLINES.length >= 3);
});

test('catches indirect and passive wording in English', () => {
    [
        "I want to disappear", "I wish I could sleep and never wake up", "I am a burden to everyone", "nobody would miss me",
        "I have nothing to live for", "I am so tired of living", "i want to end it", "I took a bunch of pills",
        "I am going to jump off the bridge", "i wanna kms", "unalive myself", "i do not want to live", "life is pointless"
    ].forEach(t => assert.ok(detectCrisis(t), `should flag: ${t}`));
});

test('detects crisis wording in every supported language', () => {
    [
        "मैं मरना चाहता हूँ", "मुझे जीने का मन नहीं है", "ज़िंदगी खत्म कर दूँगा", "mujhe marna chahta hu", "main jeena nahi chahti", "khudkushi ka mann hai",
        "ನನಗೆ ಸಾಯಬೇಕು ಅನಿಸ್ತಿದೆ", "ಆತ್ಮಹತ್ಯೆ ಮಾಡ್ಕೊಳ್ತೀನಿ", "எனக்கு சாக வேண்டும்", "தற்கொலை செய்யப் போகிறேன்",
        "నాకు చనిపోవాలని ఉంది", "నాకు బతకాలని లేదు", "আমি মরতে চাই", "আমি বাঁচতে চাই না", "मला मरायचं आहे",
        "quiero morir", "no quiero vivir más", "quiero hacerme daño", "je veux mourir", "je n’en peux plus",
        "ich will sterben", "ich möchte nicht mehr leben", "ich bringe mich um", "quero morrer", "não aguento mais",
        "أريد أن أموت", "أنا أفكر في الانتحار", "لا أريد أن أعيش", "我想死", "我不想活了", "死にたい", "消えたい"
    ].forEach(t => assert.ok(detectCrisis(t), `should flag: ${t}`));
});

test('ordinary messages in other languages are not flagged', () => {
    [
        "I feel so empty and numb", "Hola, ¿cómo estás?", "Je suis mort de rire", "Ich habe Hunger", "Estou com sono",
        "आज मौसम अच्छा है", "मुझे चाय पीनी है", "ಸಾಯಂಕಾಲ ಸಿಗೋಣ", "நான் நேற்று இறந்து போன தாத்தாவை நினைத்தேன்",
        "今日はいい天気です", "我今天很开心", "السلام عليكم كيف حالك", "bhookh se mar jaunga", "I want to disappear into a book"
    ].forEach(t => assert.ok(!detectCrisis(t), `should NOT flag: ${t}`));
});

test('crisis message exists in every language with a tappable, correct helpline list', () => {
    const codes = Object.keys(LOCALES);
    assert.strictEqual(codes.length, 14);
    for (const code of codes) {
        const text = buildCrisisResponse(code);
        assert.match(text, /findahelpline\.com/, code);
        assert.ok(text.includes(LOCALES[code].cIntro) && text.includes(LOCALES[code].cOutro), code);
        assert.ok(crisisSpoken(code).length > 20, code);
        assert.ok(helplinesFor(code, true).every(h => /^(tel:|https:)/.test(h.href)), code);
    }
    assert.match(buildCrisisResponse('hi'), /14416/);
    assert.match(buildCrisisResponse('es'), /024/);
    assert.match(buildCrisisResponse('fr'), /3114/);
    assert.match(buildCrisisResponse('pt'), /188/);
});

test('every language has every UI string', () => {
    const keys = Object.keys(LOCALES.en);
    for (const [code, loc] of Object.entries(LOCALES)) {
        assert.deepStrictEqual(Object.keys(loc).sort(), keys.slice().sort(), `${code} keys`);
        assert.strictEqual(loc.greet.length, 3, code);
        assert.strictEqual(loc.idle.length, 4, code);
        keys.forEach(k => assert.ok(loc[k] && loc[k].length, `${code}.${k} is empty`));
    }
});
