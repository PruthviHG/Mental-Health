// Keeps the page's files honest: every script the page lists exists, every script on disk is used, every icon has a rule.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
const index = read('index.html');

test('every script and stylesheet the page links exists, and scripts are deferred', () => {
    const scripts = [...index.matchAll(/<script src="([^"]+)"([^>]*)>/g)];
    assert.ok(scripts.length >= 25);
    for (const [, src, rest] of scripts) { assert.ok(fs.existsSync(path.join(root, src)), src); assert.match(rest, /defer/, src + ' blocks rendering'); }
    for (const [, href] of index.matchAll(/<link rel="(?:stylesheet|preload)" href="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, href)), href);
});

test('every script in js/ is loaded by a page (no dead files)', () => {
    const pages = index + read('performance.html');
    for (const f of walk('js')) assert.ok(pages.includes(f), f + ' is not used by any page');
});

test('scripts live in js/<group>/ folders, not loose in js/', () => {
    assert.deepStrictEqual(fs.readdirSync(path.join(root, 'js'), { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name), []);
});

test('every Font Awesome icon the page uses has a rule in icons.css', () => {
    const css = read('assets/css/icons.css');
    const used = new Set();
    for (const f of ['index.html', 'performance.html', ...walk('js')]) for (const m of read(f).matchAll(/\bfa-([a-z][a-z0-9-]+)/g)) used.add(m[1]);
    for (const name of used) assert.ok(css.includes('.fa-' + name + '{'), 'no icon rule for fa-' + name);
});

test('no page library is requested from another server', () => {
    for (const bad of ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'])
        assert.ok(!index.includes(bad), bad);
});

test('the built Tailwind file covers the classes used in the page head and header', () => {
    const css = read('assets/css/tailwind.css');
    for (const cls of ['.flex', '.hidden', '.fixed', '.inset-0', '.items-center', '.justify-between']) assert.ok(css.includes(cls), cls + ' missing: run npm run build:css');
});
