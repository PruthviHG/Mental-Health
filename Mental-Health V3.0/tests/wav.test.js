const test = require('node:test');
const assert = require('node:assert');
const { encodeWav } = require('../js/wav.js');

test('encodeWav writes a valid 16-bit mono PCM header and clips samples', () => {
    const buf = encodeWav(new Float32Array([0, 0.5, -0.5, 2, -2]), 16000);
    const v = new DataView(buf), str = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
    assert.strictEqual(str(0, 4), 'RIFF'); assert.strictEqual(str(8, 4), 'WAVE'); assert.strictEqual(str(36, 4), 'data');
    assert.strictEqual(v.getUint16(20, true), 1);          // PCM
    assert.strictEqual(v.getUint16(22, true), 1);          // mono
    assert.strictEqual(v.getUint32(24, true), 16000);      // sample rate
    assert.strictEqual(v.getUint32(40, true), 10);         // 5 samples * 2 bytes
    assert.strictEqual(buf.byteLength, 44 + 10);
    assert.strictEqual(v.getInt16(44 + 6, true), 32767);   // +2.0 clipped
    assert.strictEqual(v.getInt16(44 + 8, true), -32768);  // -2.0 clipped
});

test('encodeWav caps clips at 20 seconds', () => {
    const buf = encodeWav(new Float32Array(16000 * 30), 16000);
    assert.strictEqual(buf.byteLength, 44 + 16000 * 20 * 2);
});
