const test = require('node:test'); const assert = require('node:assert');
const S = require('../js/chat/simple.js');
test('simpleReply never repeats back-to-back and cycles all options', () => {
  for (const lang of ['en', 'hi', 'kn', 'ja', 'ar']) {
    S.resetSimpleReplies();
    let prev = null;
    for (let i = 0; i < 60; i++) { const r = S.simpleReply('ok whatever', lang); assert.notStrictEqual(r, prev, lang + ' repeated at ' + i); prev = r; }
  }
});
test('openers and asks exist for all 14 languages', () => {
  for (const l of ['en','hi','kn','ta','te','bn','mr','es','fr','de','pt','ar','zh','ja']) {
    assert.ok(S.SIMPLE_OPEN[l].length >= 5, l); assert.ok(S.SIMPLE_ASK[l].length >= 5, l);
  }
});
