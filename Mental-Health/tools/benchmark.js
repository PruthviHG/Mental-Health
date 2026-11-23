// Measures what Mindsence can honestly measure about itself and writes js/perf/perf_data.js for the Performance page.
//   node tools/benchmark.js          (browser timings are added by tools/benchmark_browser.py, which merges into the same file)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');
const { CRISIS, LANGS, HELD_CRISIS, HELD_LANGS } = require('./bench_data.js');
const safety = require(path.join(root, 'js/chat/safety.js'));
const global_ = globalThis;
// i18n.js is browser code (uses LOCALES etc.): load it in a tiny sandbox
const vm = require('vm');
function loadI18n() {
    const ctx = { module: { exports: {} }, console, navigator: { languages: ['en'] }, localStorage: { getItem() { return null; }, setItem() {} }, MINDSENCE: {}, document: undefined };
    ctx.window = ctx; vm.createContext(ctx);
    for (const f of ['js/i18n/locales.js', 'js/i18n/locales2.js', 'js/i18n/locales3.js', 'js/i18n/locales4.js', 'js/i18n/i18n.js']) {
        let src = fs.readFileSync(path.join(root, f), 'utf8');
        src = src.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
        vm.runInContext(src.replace(/if \(typeof module[\s\S]*$/m, ''), ctx, { filename: f });
    }
    return ctx;
}
const I = loadI18n();

function prf(rows, pred) {
    let tp = 0, fp = 0, tn = 0, fn = 0; const misses = [];
    for (const [lang, text, y] of rows) { const p = pred(text) ? 1 : 0; if (y && p) tp++; else if (!y && p) { fp++; misses.push({ lang, text, kind: 'false alarm' }); } else if (!y && !p) tn++; else { fn++; misses.push({ lang, text, kind: 'missed' }); } }
    const r = (a, b) => b ? a / b : 1;
    return { tp, fp, tn, fn, precision: r(tp, tp + fp), recall: r(tp, tp + fn), accuracy: r(tp + tn, tp + tn + fp + fn), n: rows.length, misses };
}
const byLang = {};
const BOTH = CRISIS.concat(HELD_CRISIS);
for (const l of [...new Set(BOTH.map(r => r[0]))]) byLang[l] = prf(BOTH.filter(r => r[0] === l), safety.detectCrisis);
const crisis = prf(CRISIS, safety.detectCrisis);
const held = prf(HELD_CRISIS, safety.detectCrisis);

let ok = 0; const langMiss = []; const langBy = {};
for (const [l, text] of LANGS) {
    const d = I.detectLang(text); const hit = d === l; if (hit) ok++; else langMiss.push({ lang: l, text, got: d });
    (langBy[l] = langBy[l] || [0, 0])[1]++; if (hit) langBy[l][0]++;
}

let hok = 0; const hmiss = [];
for (const [l, text] of HELD_LANGS) { const d = I.detectLang(text); if (d === l) hok++; else hmiss.push({ lang: l, text, got: d }); }
const heldLang = { n: HELD_LANGS.length, accuracy: hok / HELD_LANGS.length, misses: hmiss };

// speed: the safety check and language detection run on every message, on the device
function bench(fn, items, reps) {
    for (let i = 0; i < 200; i++) fn(items[i % items.length]);                       // warm-up
    const t0 = process.hrtime.bigint();
    for (let r = 0; r < reps; r++) for (const it of items) fn(it);
    return Number(process.hrtime.bigint() - t0) / 1e6 / (reps * items.length);      // ms per call
}
const msgs = CRISIS.map(r => r[1]);
const speed = {
    crisisMs: bench(safety.detectCrisis, msgs, 200),
    langMs: bench(I.detectLang, LANGS.map(r => r[1]), 200)
};

// weight: what the browser must download for the app itself
const read = (f) => fs.readFileSync(path.join(root, f));
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
const jsFiles = walk('js').filter(f => f.endsWith('.js') && !f.startsWith('js/perf/'));        // the Performance page's own files are not part of the chat app
const gz = (f) => zlib.gzipSync(read(f)).length;
const rawJs = jsFiles.reduce((n, f) => n + read(f).length, 0);
const gzJs = jsFiles.reduce((n, f) => n + gz(f), 0);
const cssFiles = ['style.css', 'assets/css/tailwind.css'];
const css = Buffer.concat(cssFiles.map(read)), html = read('index.html');
// Libraries are served from our own server, so they count: the 14 inline icons + every font file (an upper bound: the browser only fetches the files it draws)
const libFiles = ['assets/css/icons.css', 'assets/vendor/fonts/fonts.css'];
const fontFiles = [].concat(fs.readdirSync(path.join(root, 'assets/vendor/fonts')).filter(f => f.endsWith('.woff2')).map(f => 'assets/vendor/fonts/' + f));
const libsGz = libFiles.reduce((n, f) => n + gz(f), 0) + fontFiles.reduce((n, f) => n + read(f).length, 0);   // woff2 is already compressed
const appGz = gzJs + cssFiles.reduce((n, f) => n + gz(f), 0) + zlib.gzipSync(html).length;
const weight = { jsFiles: jsFiles.length, jsKB: rawJs / 1024, jsGzKB: gzJs / 1024, cssKB: css.length / 1024, htmlKB: html.length / 1024, appGzKB: appGz / 1024, libsGzKB: libsGz / 1024, totalGzKB: (appGz + libsGz) / 1024 };

// coverage counted from the code itself
const langCodes = Object.keys(I.LOCALES);
const games = (html.toString().match(/prepareGame\('/g) || []).length;
const coverage = { languages: langCodes.length, games, helplineRegions: safety.HELPLINES.length, crisisPatterns: (fs.readFileSync(path.join(root, 'js/chat/safety.js'), 'utf8').match(/^\s*\/.*\/[a-z]*,?\s*$/gm) || []).length,
    supportVideos: require(path.join(root, 'js/chat/stories.js')).SUPPORT_VIDEOS.length, supportStories: require(path.join(root, 'js/chat/stories.js')).SUPPORT_STORIES.length };

const out = { generated: new Date().toISOString().slice(0, 10), node: process.version,
    crisis: { ...crisis, perLang: Object.fromEntries(Object.entries(byLang).map(([k, v]) => [k, { n: v.n, accuracy: v.accuracy, recall: v.recall, precision: v.precision }])), misses: crisis.misses },
    lang: { n: LANGS.length, accuracy: ok / LANGS.length, perLang: Object.fromEntries(Object.entries(langBy).map(([k, v]) => [k, v[0] / v[1]])), misses: langMiss },
    speed, weight, coverage,
    heldOut: { crisis: { n: HELD_CRISIS.length, recall: held.recall, precision: held.precision, accuracy: held.accuracy, misses: held.misses }, lang: heldLang },
    // Measured on the FIRST run of each set, before any fix (kept here as plain facts; see the notes on the page).
    firstLook: { crisis1: { n: 104, recall: 44 / 52, precision: 44 / 45, accuracy: 95 / 104, missed: 8, falseAlarms: 1 }, lang1: { n: 56, accuracy: 50 / 56 }, crisis2: { n: 56, recall: 7 / 28, precision: 1, accuracy: 35 / 56, missed: 21, falseAlarms: 0 }, lang2: null } };
let prev = {}; try { prev = JSON.parse(fs.readFileSync(path.join(root, 'tools/browser_results.json'), 'utf8')); } catch (e) { /* none yet */ }
out.browser = prev.browser || null;
fs.writeFileSync(path.join(root, 'js/perf/perf_data.js'), '// Generated by tools/benchmark.js - do not edit by hand.\nconst PERF_DATA = ' + JSON.stringify(out, null, 1) + ';\nif (typeof module !== "undefined" && module.exports) module.exports = PERF_DATA;\n');
console.log(JSON.stringify({ crisis: { acc: crisis.accuracy, rec: crisis.recall, prec: crisis.precision, fn: crisis.fn, fp: crisis.fp, n: crisis.n }, lang: out.lang.accuracy, speed, weight, coverage }, null, 1));
console.log('misses:', crisis.misses.map(m => m.lang + ':' + m.kind + ':' + m.text), langMiss);
