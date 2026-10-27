const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/companion.js');

test('genres map to the official NCS playlists; calm stays local; unknown styles are honest', () => {
    assert.strictEqual(C.matchGenre('I love EDM and house').key, 'electronic');
    assert.strictEqual(C.matchGenre('some trap or hip hop').key, 'trap');
    assert.strictEqual(C.matchGenre('rock and drum and bass').key, 'dnb');
    assert.strictEqual(C.matchGenre('something chill and calm').key, 'calm');
    assert.strictEqual(C.matchGenre('lofi').list, null);
    assert.strictEqual(C.matchGenre('old bollywood songs').key, 'unknown');
    assert.strictEqual(C.matchGenre('what a day'), null);
    C.MUSIC_GENRES.filter(g => g.list).forEach(g => assert.match(g.list, /^PLRBp0Fe2Gpg[\w-]{22}$/));
});

test('colours in many languages, hex, and neutrals', () => {
    assert.strictEqual(C.parseColor('blue').hue, 215);
    assert.strictEqual(C.parseColor('मुझे गुलाबी पसंद है').hue, 330);
    assert.strictEqual(C.parseColor('ನೀಲಿ').hue, 215);
    assert.strictEqual(C.parseColor('verde').hue, 125);
    assert.strictEqual(C.parseColor('我喜欢紫色').hue, 270);
    assert.ok(Math.abs(C.parseColor('#ff0000').hue) < 1);
    assert.strictEqual(C.parseColor('black').neutral, 'black');
    assert.strictEqual(C.parseColor('zzz'), null);
});

test('hue rotation takes the short way round and is relative to the default cyan', () => {
    assert.strictEqual(C.hueRotationFor(183), 0);
    assert.strictEqual(C.hueRotationFor(270), 87);
    for (const h of [0, 28, 50, 125, 215, 300, 330]) assert.ok(Math.abs(C.hueRotationFor(h)) <= 180, String(h));
});

test('names are only taken when stated, never from feelings', () => {
    assert.strictEqual(C.extractName('my name is asha'), 'Asha');
    assert.strictEqual(C.extractName("I'm Ravi and I'm tired"), 'Ravi');
    assert.strictEqual(C.extractName("I'm tired"), null);
    assert.strictEqual(C.extractName('i am so sad'), null);
});

test('every language has all the lines; placeholders survive', () => {
    for (const l of ['en', 'hi', 'kn', 'ta', 'te', 'bn', 'mr', 'es', 'fr', 'de', 'pt', 'ar', 'zh', 'ja']) {
        const t = C.COMPANION_TEXT[l];
        for (const k of ['cGreet', 'cSongs', 'cSongsOk', 'cSongsNone', 'cColor', 'cColorOk', 'cColorNone']) assert.ok(t[k] && t[k].length > 8, `${l}.${k}`);
        assert.ok(t.cSongsOk.includes('{g}'), l + ' {g}');
        assert.ok(t.cColorOk.includes('{c}'), l + ' {c}');
    }
});
