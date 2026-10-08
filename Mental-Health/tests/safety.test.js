const test = require('node:test');
const assert = require('node:assert');
const { detectCrisis, HELPLINES, CRISIS_RESPONSE } = require('../js/safety.js');

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
