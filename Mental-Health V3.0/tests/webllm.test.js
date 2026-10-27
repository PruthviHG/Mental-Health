// On-device AI: model choice, prompt parity with the server, and that the pieces stay consistent.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, navigator: {}, localStorage: { getItem() { return null; }, setItem() {} } });
for (const n of ['config', 'webllm']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', `${n}.js`), 'utf8'), ctx, { filename: `${n}.js` });
const run = (code) => vm.runInContext(code, ctx);

test('picks the first preferred model this WebLLM build ships, or honours an override', () => {
    assert.strictEqual(run('pickWebModel(["x","Llama-3.2-1B-Instruct-q4f16_1-MLC","Qwen2.5-1.5B-Instruct-q4f16_1-MLC"], WEBLLM_PREFERRED, "")'), 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('pickWebModel(["Llama-3.2-1B-Instruct-q4f32_1-MLC"], WEBLLM_PREFERRED, "")'), 'Llama-3.2-1B-Instruct-q4f32_1-MLC');
    assert.strictEqual(run('pickWebModel(["unrelated"], WEBLLM_PREFERRED, "")'), null);
    assert.strictEqual(run('pickWebModel([], WEBLLM_PREFERRED, "")'), 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('pickWebModel(["a"], WEBLLM_PREFERRED, "my-model")'), 'my-model');
});

test('the on-device prompt is short but keeps every safety rule', () => {
    const prompt = run('ON_DEVICE_SYSTEM_PROMPT');
    assert.ok(prompt.length < 1450, `prompt is ${prompt.length} chars; a small model re-reads it every turn, keep it short`);
    assert.match(prompt, /not a human and not a therapist/);
    assert.match(prompt, /SAME language and script/);
    assert.match(prompt, /Never joke about pain, death, self-harm/);
    assert.match(prompt, /give no methods/);
    assert.match(prompt, /crisis line or a trusted person/);
    assert.match(prompt, /no diagnoses or medication advice/);
    assert.match(prompt, /Never discourage human support/);
});

test('care mode, language and voice tone reach the on-device prompt', () => {
    const p = run('buildOnDevicePrompt({ lang: "hi", crisis: true, emotion: { label: "sad", confidence: 0.8 } })');
    assert.match(p, /No jokes or teasing/);
    assert.match(p, /set to hi/);
    assert.match(p, /sound sad \(80% confidence\)/);
    assert.doesNotMatch(run('buildOnDevicePrompt({ lang: "en" })'), /No jokes or teasing/);
});

test('without WebGPU the feature stays off', () => {
    assert.strictEqual(run('webGpuAvailable()'), false);
});

test('small devices get the light model, strong ones the better one', () => {
    assert.strictEqual(run('modelPreferenceFor({ deviceMemory: 4 })')[0], 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('modelPreferenceFor({ cores: 4 })')[0], 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('modelPreferenceFor({ mobile: true, deviceMemory: 8, cores: 8 })')[0], 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('modelPreferenceFor({ deviceMemory: 8, cores: 8 })')[0], 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
    assert.strictEqual(run('modelPreferenceFor({})')[0], 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');          // unknown hardware: do not downgrade
    assert.strictEqual(run('pickWebModel(["Qwen2.5-0.5B-Instruct-q4f16_1-MLC"], modelPreferenceFor({ cores: 2 }), "")'), 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
});

test('the download starts by itself only on a fast, unmetered connection', () => {
    assert.strictEqual(run('shouldAutoStart(null)'), true);
    assert.strictEqual(run('shouldAutoStart({ effectiveType: "4g" })'), true);
    assert.strictEqual(run('shouldAutoStart({ effectiveType: "3g" })'), false);
    assert.strictEqual(run('shouldAutoStart({ saveData: true, effectiveType: "4g" })'), false);
    assert.strictEqual(run('shouldAutoStart({ type: "cellular" })'), false);
});
