const test = require('node:test');
const assert = require('node:assert');
const { parseCommand, vibeHueFor } = require('../js/chat/commands.js');

const cases = [
    ['volume down a bit', { name: 'volume', delta: -8 }], ['lower the volume', { name: 'volume', delta: -15 }], ['too loud', { name: 'volume', delta: -15 }],
    ['volume up', { name: 'volume', delta: 15 }], ['I cant hear', { name: 'volume', delta: 15 }], ['volume to 30%', { name: 'volumeSet', value: 30 }],
    ['mute', { name: 'mute' }], ['unmute', { name: 'unmute' }], ['change the song', { name: 'next' }], ['skip', { name: 'next' }],
    ['previous song', { name: 'prev' }], ['pause the music', { name: 'pause' }], ['resume', { name: 'resume' }],
    ['make the text bigger', { name: 'textSize', delta: 12 }], ['stop the particles', { name: 'particles', on: false }],
    ['particles faster', { name: 'particleSpeed', factor: 1.5 }], ['open games', { name: 'open', where: 'games' }],
    ['stop talking', { name: 'voice', on: false }], ['turn on your voice', { name: 'voice', on: true }],
    ['the songs like i\'m listening now', { name: 'similar' }], ['more like this', { name: 'similar' }], ['same vibe please', { name: 'similar' }],
    ['did i told you to change that song?', { name: 'complaint' }], ['i didn\'t ask you to change it', { name: 'complaint' }],
    ['change the color according to the vibe', { name: 'vibeColor', auto: true }], ['match the colour to the song', { name: 'vibeColor', auto: false }],
    ['go back', { name: 'prev' }], ['undo', { name: 'prev' }],
    ['speak in hindi', { name: 'language', code: 'hi' }], ['switch to spanish', { name: 'language', code: 'es' }]
];
for (const [text, want] of cases) test(`command: "${text}"`, () => assert.deepStrictEqual(parseCommand(text), want));

// ordinary conversation must never be treated as a command
for (const text of ['hello', 'fuck', 'I feel so loud inside', 'i am so down today', 'how do I turn the volume down?', 'play shape of you', 'i love music',
    'I want to go back to school', 'what is the volume', 'my head is so loud and I cannot think about anything at all right now honestly']) {
    test(`not a command: "${text}"`, () => assert.strictEqual(parseCommand(text), null));
}

test('the vibe of a song picks a colour that fits it', () => {
    assert.strictEqual(vibeHueFor('Post Malone - Sunflower').name, 'golden');
    assert.strictEqual(vibeHueFor('Sia - Cheap Thrills').name, 'magenta');
    assert.strictEqual(vibeHueFor('lofi chill beats to relax').name, 'blue');
    assert.strictEqual(vibeHueFor('Lauv - I Like Me Better').name, 'pink');
    assert.deepStrictEqual(vibeHueFor('Some Unknown Title'), vibeHueFor('Some Unknown Title'));   // stable
});
test('questions about what just happened are not commands', () => {
    assert.strictEqual(parseCommand('did you change the song?'), null);
    assert.strictEqual(parseCommand('why is the volume so low'), null);
});
test('chat-log regressions: background, misunderstood, vibe colour with "to"', () => {
    assert.strictEqual(parseCommand('can you play in background')?.name, 'background');
    assert.strictEqual(parseCommand("that's not what I meant")?.name, 'misunderstood');
    assert.strictEqual(parseCommand('change the colour to the Vibe')?.name, 'vibeColor');
});
test('"not this one" / "wrong song" / "find a different one" are an actionable skip, not just an apology', () => {
    assert.strictEqual(parseCommand('not this one')?.name, 'rejectSong');
    assert.strictEqual(parseCommand('wrong song')?.name, 'rejectSong');
    assert.strictEqual(parseCommand('find a different one')?.name, 'rejectSong');
    // still generic for a non-song correction, unchanged behaviour
    assert.strictEqual(parseCommand("that's not what I meant")?.name, 'misunderstood');
});
