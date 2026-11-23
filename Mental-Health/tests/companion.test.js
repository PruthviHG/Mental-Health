const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/chat/companion.js');

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

test('music and colour requests are understood in Hindi, Kannada and the other languages', () => {
    const play = (s) => C.PLAY_VERB.test(s) && C.MUSIC_NOUN.test(s);
    for (const s of ['कुछ संगीत चलाओ', 'ಸಂಗೀತ ಹಾಕಿ', 'இசை போடு', 'సంగీతం పెట్టు', 'গান চালাও', 'गाणी लाव', 'pon música', 'mets de la musique', 'spiel Musik', 'toca música', 'شغل موسيقى', '播放音乐', '音楽をかけて']) assert.ok(play(s), s);
    for (const s of ['संगीत बंद करो', 'ಸಂಗೀತ ನಿಲ್ಲಿಸಿ', 'இசை நிறுத்து', 'సంగీతం ఆపు', 'গান বন্ধ করো', 'para la música', 'arrête la musique', 'stopp die Musik', 'أوقف الموسيقى', '停止音乐', '音楽を止めて']) assert.ok(C.MUSIC_STOP.test(s) && C.MUSIC_NOUN.test(s), s);
    for (const s of ['अगला गाना', 'ಮುಂದಿನ ಹಾಡು', 'அடுத்த பாடல்', 'తర్వాతి పాట', 'পরের গান', 'पुढचं गाणं', 'siguiente canción', 'chanson suivante', 'nächstes Lied', 'próxima música', '下一首', '次の曲']) assert.ok(C.MUSIC_NEXT.test(s), s);
    for (const s of ['मूल रंग वापस करो', 'ಮೊದಲಿನ ಬಣ್ಣ', 'color original', 'couleur d\'origine', 'ursprüngliche Farbe', 'cor original', '原来的颜色', '元の色']) assert.ok(C.COLOR_RESET.test(s), s);
    for (const s of ['ನನಗೆ ನೀಲಿ ಬಣ್ಣ ಇಷ್ಟ', 'मुझे हरा रंग पसंद है', 'நிறம் சிவப்பு', 'నాకు పసుపు రంగు', 'আমার প্রিয় রং লাল', 'es mi color verde', 'ma couleur est le rouge', '我喜欢绿色颜色']) { assert.ok(C.COLOR_NOUN.test(s) && C.parseColor(s), s); }
});

test('Hindi and Kannada companion lines exist for stop / next / reset (via the locale tables)', () => {
    const L = require('../js/i18n/locales4.js').LOCALES;
    for (const l of ['hi', 'kn']) for (const k of ['cColorReset', 'cMusicOff', 'cMusicNext']) assert.ok(L[l][k] && L[l][k] !== L.en[k], l + k);
});

test('"play <any song>" is understood in many languages, and ordinary talk is not mistaken for a request', () => {
    const q = (s) => C.extractSongQuery(s);
    assert.strictEqual(q('play Shape of You'), 'Shape of You');            // "you" inside a title survives
    assert.strictEqual(q('play On Top of the World'), 'On Top of the World');
    assert.strictEqual(q('can you play despacito by luis fonsi please'), 'despacito by luis fonsi');
    assert.strictEqual(q('I want to listen to Perfect by Ed Sheeran'), 'Perfect by Ed Sheeran');
    assert.strictEqual(q('Kesariya song play please'), 'Kesariya');
    assert.strictEqual(q('ಕೇಸರಿಯಾ ಹಾಡು ಹಾಕಿ'), 'ಕೇಸರಿಯಾ');
    assert.strictEqual(q('ದಯವಿಟ್ಟು ಕೇಸರಿಯಾ ಹಾಡು ಹಾಕಿ'), 'ಕೇಸರಿಯಾ');
    assert.strictEqual(q('तुम ही हो गाना चलाओ'), 'तुम ही हो');
    assert.strictEqual(q('अरिजीत सिंह के गाने चलाओ'), 'अरिजीत सिंह');
    assert.strictEqual(q('என் இனிய பொன் நிலாவே பாடல் போடு'), 'என் இனிய பொன் நிலாவே');
    assert.strictEqual(q('నాకు నాటు నాటు పాట పెట్టు'), 'నాటు నాటు');
    assert.strictEqual(q('pon Despacito'), 'Despacito');
    assert.strictEqual(q('mets Alors on danse'), 'Alors on danse');
    assert.strictEqual(q('spiel Lose Yourself'), 'Lose Yourself');
    assert.strictEqual(q('toca Garota de Ipanema'), 'Garota de Ipanema');
    assert.strictEqual(q('播放 晴天'), '晴天');
    assert.strictEqual(q('夜に駆ける かけて'), '夜に駆ける');
    for (const none of ['play some music', 'I love music', 'what is a song', 'I feel sad play something', 'hello how are you', 'कुछ गाना चलाओ', 'I am tired', '']) assert.strictEqual(q(none), null, none);
});
