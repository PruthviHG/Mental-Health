const test = require('node:test');
const assert = require('node:assert');
const { LOCALES, UI_KEYS } = require('../js/i18n/locales4.js');
const { STORY_I18N, SOURCE_LABEL } = require('../js/i18n/stories_i18n.js');
const S = require('../js/chat/stories.js');
const CODES = ['en', 'hi', 'kn', 'ta', 'te', 'bn', 'mr', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'ja'];

test('every language has every new UI string; non-English differs from English', () => {
    for (const l of CODES) for (const k of UI_KEYS) {
        const v = LOCALES[l][k]; assert.ok(v !== undefined && v !== '', `${l}.${k}`);
        if (Array.isArray(LOCALES.en[k])) assert.strictEqual(v.length, LOCALES.en[k].length, `${l}.${k} length`);
        if (l !== 'en' && ['fbSend', 'abHead', 'eCreds', 'eNet', 'backToast'].includes(k)) assert.notStrictEqual(v, LOCALES.en[k], `${l}.${k} untranslated`);
    }
});

test('Hindi and Kannada have every story; every language has the "matter" story and a source label', () => {
    for (const l of ['hi', 'kn']) for (const s of S.SUPPORT_STORIES) assert.ok(STORY_I18N[l][s.id] && STORY_I18N[l][s.id].text.length > 40, `${l}.${s.id}`);
    for (const l of CODES.filter(c => c !== 'en')) { assert.ok(STORY_I18N[l].matter.text.length > 80, l); assert.ok(SOURCE_LABEL[l], l); }
});

test('story selection never returns English text inside another language', () => {
    for (const l of CODES.filter(c => c !== 'en')) for (const theme of ['pain', 'job', 'failure', 'nobody', 'grief']) {
        const st = S.pickSupportStory(theme, l);
        assert.ok(STORY_I18N[l][st.id], `${l}/${theme}/${st.id}`);
    }
});

test('performance page data is complete and honest', () => {
    const D = require('../js/perf/perf_data.js');
    assert.ok(D.crisis.n >= 100 && D.heldOut.crisis.n >= 50);
    assert.strictEqual(D.crisis.recall, 1);                      // regression: nothing in either set may go missing again
    assert.strictEqual(D.heldOut.crisis.recall, 1);
    assert.ok(D.crisis.precision >= 0.95 && D.heldOut.crisis.precision >= 0.95);
    assert.ok(D.firstLook.crisis2.recall < 0.5, 'the first-look number must stay on the page');
    assert.ok(D.lang.accuracy >= 0.95 && D.heldOut.lang.accuracy >= 0.75);
    assert.ok(D.speed.crisisMs < 1 && D.weight.totalGzKB < 400);
    assert.strictEqual(D.coverage.languages, 14);
});
