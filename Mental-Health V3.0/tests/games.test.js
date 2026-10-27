// Timing + Block Blast rules (no canvas needed; drawing is not exercised here).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function setup() {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:8000/' });
    const w = dom.window;
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
    const ctx = dom.getInternalVMContext();
    for (const name of ['core', 'sfx', 'games', 'blast']) {
        new vm.Script(fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8'), { filename: name }).runInContext(ctx);
    }
    const run = (c) => new vm.Script(c).runInContext(ctx);
    return { w, run };
}

test('Data Link is gone and Block Blast is in the menu', () => {
    const { w, run } = setup();
    try {
        const html = w.document.getElementById('arcade-menu').innerHTML;
        assert.match(html, /BLOCK BLAST/);
        assert.doesNotMatch(html, /DATA LINK|prepareGame\('flow'\)/);
        assert.strictEqual(run("typeof gameData.blast"), 'object');
        assert.strictEqual(run("typeof gameData.flow"), 'undefined');
    } finally { w.close(); }
});

test('box breathing follows real seconds, independent of frame rate', () => {
    const { w, run } = setup();
    try {
        const at = (t) => JSON.parse(run(`JSON.stringify(breatheAt(${t}))`));
        assert.deepStrictEqual([at(0).name, at(3.9).name, at(4).name, at(8).name, at(12).name, at(16).name],
                               ['INHALE', 'INHALE', 'HOLD', 'EXHALE', 'HOLD', 'INHALE']);
        assert.strictEqual(at(0).remaining, 4);
        assert.strictEqual(at(3.2).remaining, 1);
        assert.strictEqual(at(35).cycles, 2);
        assert.ok(Math.abs(at(2).progress - 0.5) < 1e-9);
    } finally { w.close(); }
});

test('desk yoga changes pose every 10 real seconds and the countdown matches', () => {
    const { w, run } = setup();
    try {
        const at = (t) => JSON.parse(run(`JSON.stringify(yogaAt(${t}))`));
        assert.strictEqual(at(0).index, 0); assert.strictEqual(at(9.99).index, 0);
        assert.strictEqual(at(10).index, 1); assert.strictEqual(at(25).index, 2);
        assert.strictEqual(at(0.1).remaining, 10); assert.strictEqual(at(9.5).remaining, 1);
        assert.strictEqual(run('formatClock(75)'), '1:15');
    } finally { w.close(); }
});

test('block blast: placing a piece completes a row, clears it, scores and combos', () => {
    const { w, run } = setup();
    try {
        run("currentGame = 'blast'; initBlast();");
        // bottom row full except the first 3 cells; give the player a horizontal 3-line
        run("blast.grid[0][0] = 3; for (let c = 3; c < 8; c++) blast.grid[7][c] = 1; blast.pieces = [blastMakePiece(['###']), blastMakePiece(['#']), blastMakePiece(['##'])];");
        const res = JSON.parse(run("JSON.stringify(blastPlace(0, 0, 7))"));
        assert.strictEqual(res.lines, 1);
        assert.strictEqual(run("blast.grid[7].every(v => v === 0)"), true);
        assert.strictEqual(run("blast.combo"), 1);
        assert.strictEqual(run("score"), 3 + 10);                      // 3 cells + 10 for one line
        // a clearing column + row at once scores more than two separate singles
        run("blast.grid = Array.from({length: 8}, () => Array(8).fill(0)); blast.grid[5][5] = 2; for (let i = 0; i < 8; i++) { if (i !== 0) { blast.grid[0][i] = 1; blast.grid[i][0] = 1; } } score = 0; blast.combo = 0; blast.pieces = [blastMakePiece(['#']), blastMakePiece(['#']), blastMakePiece(['#'])];");
        const two = JSON.parse(run("JSON.stringify(blastPlace(0, 0, 0))"));
        assert.strictEqual(two.lines, 2);
        assert.ok(two.gain > 20);
    } finally { w.close(); }
});

test('block blast: validates placement and detects a dead board', () => {
    const { w, run } = setup();
    try {
        run("currentGame = 'blast'; initBlast();");
        assert.strictEqual(run("blastCanPlace(blast.grid, blastMakePiece(['###']), 6, 0)"), false);   // off the edge
        assert.strictEqual(run("blastCanPlace(blast.grid, blastMakePiece(['###']), 5, 0)"), true);
        // fill the board in a checkerboard so a 2x2 can never fit and place the last single block elsewhere
        run("for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blast.grid[y][x] = (x + y) % 2 ? 2 : 0; blast.grid[0][0] = 0;");
        run("blast.pieces = [blastMakePiece(['##','##']), blastMakePiece(['##','##']), blastMakePiece(['#'])];");
        run("blastPlace(2, 0, 0)");            // only the single fits; the remaining two squares cannot
        assert.strictEqual(run("blast.over"), true);
        run("clearTimeout(blast.overTimer)");
    } finally { w.close(); }
});

test('block blast never deals a hand with no playable piece', () => {
    const { w, run } = setup();
    try {
        run("initBlast();");
        for (let i = 0; i < 200; i++) {
            assert.strictEqual(run("blastDeal(); blast.pieces.some(p => blastFitsAnywhere(blast.grid, p))"), true);
        }
    } finally { w.close(); }
});
