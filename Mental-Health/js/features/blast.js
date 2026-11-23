// ==========================================
// --- BLOCK BLAST ---
// Drag the 3 pieces onto the 8x8 grid. Complete rows or columns to blast them.
// Chain clears for combos. Game ends when none of your pieces fit.
// ==========================================
const BLAST = { N: 8, CELL: 50, GX: 40, GY: 50, LIFT: 46 };
const BLAST_COLORS = ['#ff4d6d', '#ffb703', '#4cc9f0', '#80ed99', '#b388ff', '#ff8fab'];
const BLAST_SHAPES = [
    ["#"],
    ["##"], ["#", "#"], ["###"], ["#", "#", "#"], ["####"], ["#", "#", "#", "#"], ["#####"], ["#", "#", "#", "#", "#"],
    ["##", "##"], ["###", "###"], ["##", "##", "##"], ["###", "###", "###"],
    ["#.", "##"], [".#", "##"], ["##", "#."], ["##", ".#"],
    ["#..", "#..", "###"], ["..#", "..#", "###"], ["###", "#..", "#.."], ["###", "..#", "..#"],
    ["###", ".#."], [".#.", "###"], ["#.", "##", "#."], [".#", "##", ".#"],
    ["##.", ".##"], [".##", "##."], [".#", "##", "#."], ["#.", "##", ".#"]
];

let blast = null;

function blastBest() { try { return Number(localStorage.getItem('mindsence_blast_best')) || 0; } catch (e) { return 0; } }
function blastSaveBest(v) { try { localStorage.setItem('mindsence_blast_best', String(v)); } catch (e) { /* storage unavailable */ } }

function blastMakePiece(rows) {
    const cells = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
    return {
        cells,
        w: Math.max(...cells.map(c => c[0])) + 1,
        h: Math.max(...cells.map(c => c[1])) + 1,
        color: Math.floor(Math.random() * BLAST_COLORS.length),
        used: false
    };
}

function blastRandomPiece() {
    const weights = BLAST_SHAPES.map(rows => {
        const n = rows.join('').split('#').length - 1;
        return n >= 9 ? 0.5 : (n === 5 ? 0.7 : 1);
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < BLAST_SHAPES.length; i++) { r -= weights[i]; if (r <= 0) return blastMakePiece(BLAST_SHAPES[i]); }
    return blastMakePiece(BLAST_SHAPES[0]);
}

function blastCanPlace(grid, piece, gx, gy) {
    return piece.cells.every(([cx, cy]) => {
        const x = gx + cx, y = gy + cy;
        return x >= 0 && y >= 0 && x < BLAST.N && y < BLAST.N && !grid[y][x];
    });
}

function blastFitsAnywhere(grid, piece) {
    for (let y = 0; y <= BLAST.N - piece.h; y++)
        for (let x = 0; x <= BLAST.N - piece.w; x++)
            if (blastCanPlace(grid, piece, x, y)) return true;
    return false;
}

function blastFullLines(grid) {
    const rows = [], cols = [];
    for (let i = 0; i < BLAST.N; i++) {
        if (grid[i].every(Boolean)) rows.push(i);
        if (grid.every(row => row[i])) cols.push(i);
    }
    return { rows, cols };
}

function blastDeal() {
    for (let attempt = 0; attempt < 40; attempt++) {
        blast.pieces = [blastRandomPiece(), blastRandomPiece(), blastRandomPiece()];
        if (blast.pieces.some(p => blastFitsAnywhere(blast.grid, p))) return;   // never deal a dead hand
    }
}

function initBlast() {
    blast = {
        grid: Array.from({ length: BLAST.N }, () => Array(BLAST.N).fill(0)),
        pieces: [], drag: null, ptr: { x: 0, y: 0 },
        particles: [], texts: [], flashes: [], shake: 0,
        combo: 0, sinceClear: 0, best: blastBest(), over: false, overTimer: null
    };
    score = 0;
    blastDeal();
}

// ---------- layout ----------
function blastSlot(i) { return { x: 500, y: 118 + i * 124, w: 260, h: 110 }; }
function blastTrayCell(p) { return Math.min(30, Math.floor(96 / Math.max(p.w, p.h))); }
function blastDragOrigin(p) {
    return { x: blast.ptr.x - (p.w * BLAST.CELL) / 2, y: blast.ptr.y - (p.h * BLAST.CELL) / 2 - BLAST.LIFT };
}
function blastDragTarget(p) {
    const o = blastDragOrigin(p);
    return { gx: Math.round((o.x - BLAST.GX) / BLAST.CELL), gy: Math.round((o.y - BLAST.GY) / BLAST.CELL) };
}

// ---------- rules ----------
function blastPlace(i, gx, gy) {
    const b = blast, p = b.pieces[i];
    p.used = true;
    p.cells.forEach(([cx, cy]) => { b.grid[gy + cy][gx + cx] = p.color + 1; });

    let gain = p.cells.length;
    const { rows, cols } = blastFullLines(b.grid);
    const lines = rows.length + cols.length;
    SFX.place();

    if (lines > 0) {
        const toClear = new Set();
        rows.forEach(r => { for (let c = 0; c < BLAST.N; c++) toClear.add(r * BLAST.N + c); b.flashes.push({ row: r, life: 0.4 }); });
        cols.forEach(c => { for (let r = 0; r < BLAST.N; r++) toClear.add(r * BLAST.N + c); b.flashes.push({ col: c, life: 0.4 }); });
        toClear.forEach(k => {
            const x = k % BLAST.N, y = Math.floor(k / BLAST.N);
            blastBurst(BLAST.GX + x * BLAST.CELL + BLAST.CELL / 2, BLAST.GY + y * BLAST.CELL + BLAST.CELL / 2, BLAST_COLORS[(b.grid[y][x] - 1 + BLAST_COLORS.length) % BLAST_COLORS.length], 5);
            b.grid[y][x] = 0;
        });

        b.combo++; b.sinceClear = 0;
        const lineScore = Math.round((10 * lines + 5 * lines * (lines - 1)) * (1 + (b.combo - 1) * 0.5));
        gain += lineScore;
        SFX.clear(lines, b.combo);
        b.shake = Math.min(0.4, 0.12 + 0.07 * lines);

        const praise = lines >= 4 ? 'UNBELIEVABLE!' : lines === 3 ? 'AMAZING!' : lines === 2 ? 'GREAT!' : 'NICE!';
        blastText(praise + ' +' + lineScore, 240, 235, '#ffffff', 30);
        if (b.combo > 1) blastText('COMBO x' + b.combo, 240, 275, '#ffb703', 22);

        if (b.grid.every(row => row.every(v => !v))) {
            gain += 100;
            blastText('PERFECT CLEAR +100', 240, 195, '#80ed99', 24);
            SFX.perfect();
        }
    } else {
        b.sinceClear++;
        if (b.sinceClear >= 3) b.combo = 0;          // combo lives for 3 placements
    }

    score += gain;
    if (score > b.best) b.best = score;

    if (b.pieces.every(pc => pc.used)) blastDeal();

    const alive = b.pieces.filter(pc => !pc.used);
    if (alive.length && !alive.some(pc => blastFitsAnywhere(b.grid, pc))) blastEnd();
    return { lines, gain };
}

function blastEnd() {
    const b = blast;
    if (b.over) return;
    b.over = true;
    blastSaveBest(Math.max(b.best, score));
    SFX.gameOver();
    b.overTimer = setTimeout(() => { if (blast && blast.over && currentGame === 'blast') gameOver("NO MOVES LEFT"); }, 900);
}

// ---------- effects ----------
function blastBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220;
        blast.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 3 + Math.random() * 5 });
    }
}
function blastText(text, x, y, color, size) { blast.texts.push({ text, x, y, color, size, life: 1.1, max: 1.1 }); }

// ---------- input ----------
function blastPointer(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
function blastActive() { return currentGame === 'blast' && blast && !blast.over && !isGameOver && introScreen.style.display !== 'flex'; }

canvas.addEventListener('pointerdown', (e) => {
    if (!blastActive()) return;
    const p = blastPointer(e); blast.ptr = p;
    for (let i = 0; i < 3; i++) {
        const s = blastSlot(i), piece = blast.pieces[i];
        if (piece && !piece.used && p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
            blast.drag = { i };
            SFX.pickup();
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
            break;
        }
    }
});
canvas.addEventListener('pointermove', (e) => { if (blastActive() && blast.drag) blast.ptr = blastPointer(e); });
function blastRelease(e) {
    if (!blast || !blast.drag) return;
    const d = blast.drag; blast.drag = null;
    if (e && e.clientX !== undefined) blast.ptr = blastPointer(e);
    const piece = blast.pieces[d.i], t = blastDragTarget(piece);
    if (blastCanPlace(blast.grid, piece, t.gx, t.gy)) blastPlace(d.i, t.gx, t.gy);
    else if (blast.ptr.x < BLAST.GX + BLAST.N * BLAST.CELL + 20) SFX.invalid();   // dropped on the board but it doesn't fit
}
canvas.addEventListener('pointerup', blastRelease);
canvas.addEventListener('pointercancel', () => { if (blast) blast.drag = null; });
window.addEventListener('keydown', (e) => {
    if (currentGame === 'blast' && isArcadeActive && e.key.toLowerCase() === 'm') SFX.toggleMute();
});

// ---------- drawing ----------
function blastRR(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function blastBlock(x, y, size, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    const pad = Math.max(1, size * 0.04), s = size - pad * 2, r = size * 0.18;
    blastRR(x + pad, y + pad, s, s, r); ctx.fillStyle = color; ctx.fill();
    blastRR(x + pad, y + pad, s, s * 0.46, r); ctx.fillStyle = 'rgba(255,255,255,0.24)'; ctx.fill();
    blastRR(x + pad, y + pad, s, s, r); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;
}

function playBlast() {
    const b = blast; if (!b) return;
    const dt = Math.min(gameDt, 0.05);

    for (const p of b.particles) { p.life -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    b.particles = b.particles.filter(p => p.life > 0);
    for (const t of b.texts) { t.life -= dt; t.y -= 28 * dt; }
    b.texts = b.texts.filter(t => t.life > 0);
    for (const f of b.flashes) f.life -= dt;
    b.flashes = b.flashes.filter(f => f.life > 0);
    if (b.shake > 0) b.shake -= dt;

    ctx.save();
    if (b.shake > 0) ctx.translate((Math.random() - 0.5) * b.shake * 22, (Math.random() - 0.5) * b.shake * 22);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // board
    const size = BLAST.N * BLAST.CELL;
    blastRR(BLAST.GX - 8, BLAST.GY - 8, size + 16, size + 16, 12); ctx.fillStyle = '#12141f'; ctx.fill();
    for (let y = 0; y < BLAST.N; y++) for (let x = 0; x < BLAST.N; x++) {
        const px = BLAST.GX + x * BLAST.CELL, py = BLAST.GY + y * BLAST.CELL, v = b.grid[y][x];
        if (v) blastBlock(px, py, BLAST.CELL, BLAST_COLORS[v - 1]);
        else { blastRR(px + 2, py + 2, BLAST.CELL - 4, BLAST.CELL - 4, 6); ctx.fillStyle = (x + y) % 2 ? '#1b1e2e' : '#1f2235'; ctx.fill(); }
    }

    // ghost preview + lines that would clear
    if (b.drag) {
        const piece = b.pieces[b.drag.i], t = blastDragTarget(piece);
        if (blastCanPlace(b.grid, piece, t.gx, t.gy)) {
            const sim = b.grid.map(r => r.slice());
            piece.cells.forEach(([cx, cy]) => { sim[t.gy + cy][t.gx + cx] = piece.color + 1; });
            const { rows, cols } = blastFullLines(sim);
            const pulse = 0.18 + 0.1 * Math.sin(gameTime * 10);
            ctx.fillStyle = `rgba(255,255,255,${pulse})`;
            rows.forEach(r => ctx.fillRect(BLAST.GX, BLAST.GY + r * BLAST.CELL, size, BLAST.CELL));
            cols.forEach(c => ctx.fillRect(BLAST.GX + c * BLAST.CELL, BLAST.GY, BLAST.CELL, size));
            piece.cells.forEach(([cx, cy]) => blastBlock(BLAST.GX + (t.gx + cx) * BLAST.CELL, BLAST.GY + (t.gy + cy) * BLAST.CELL, BLAST.CELL, BLAST_COLORS[piece.color], 0.45));
        }
    }

    // clear flashes
    for (const f of b.flashes) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, f.life * 1.8)})`;
        if (f.row !== undefined) ctx.fillRect(BLAST.GX, BLAST.GY + f.row * BLAST.CELL, size, BLAST.CELL);
        else ctx.fillRect(BLAST.GX + f.col * BLAST.CELL, BLAST.GY, BLAST.CELL, size);
    }

    // tray
    for (let i = 0; i < 3; i++) {
        const s = blastSlot(i), p = b.pieces[i];
        blastRR(s.x, s.y, s.w, s.h, 12); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1; ctx.stroke();
        if (!p || p.used) continue;
        const tc = blastTrayCell(p), ox = s.x + (s.w - p.w * tc) / 2, oy = s.y + (s.h - p.h * tc) / 2;
        const dragging = b.drag && b.drag.i === i;
        const playable = blastFitsAnywhere(b.grid, p);
        p.cells.forEach(([cx, cy]) => blastBlock(ox + cx * tc, oy + cy * tc, tc, BLAST_COLORS[p.color], dragging ? 0.2 : (playable ? 1 : 0.35)));
    }

    // piece being dragged (full size, lifted above the finger)
    if (b.drag) {
        const p = b.pieces[b.drag.i], o = blastDragOrigin(p);
        p.cells.forEach(([cx, cy]) => blastBlock(o.x + cx * BLAST.CELL, o.y + cy * BLAST.CELL, BLAST.CELL, BLAST_COLORS[p.color], 0.95));
    }

    // HUD
    ctx.fillStyle = '#8a8fa8'; ctx.font = '11px monospace';
    ctx.fillText('SCORE', 500, 32); ctx.fillText('BEST', 650, 32);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px monospace';
    ctx.fillText(String(score), 500, 66); ctx.fillText(String(Math.max(b.best, score)), 650, 66);
    if (b.combo > 1) { ctx.fillStyle = '#ffb703'; ctx.font = 'bold 14px monospace'; ctx.fillText('COMBO x' + b.combo, 500, 96); }
    ctx.fillStyle = '#5c6078'; ctx.font = '11px monospace';
    ctx.fillText('Drag blocks onto the grid  |  M: ' + (SFX.muted ? 'unmute' : 'mute'), BLAST.GX, 482);

    // particles + floating text
    for (const p of b.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1; ctx.textAlign = 'center';
    for (const t of b.texts) {
        ctx.globalAlpha = Math.min(1, t.life / (t.max * 0.5));
        ctx.font = `bold ${t.size}px monospace`; ctx.fillStyle = '#000'; ctx.fillText(t.text, t.x + 2, t.y + 2);
        ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BLAST_SHAPES };
