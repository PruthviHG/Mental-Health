// ==========================================
// --- ARCADE LOGIC ---
// ==========================================
const modal = document.getElementById('game-modal'), ui = document.getElementById('main-ui'), canvas = document.getElementById('game-canvas'), ctx = canvas.getContext('2d'), gameOverScreen = document.getElementById('game-over-screen'), introScreen = document.getElementById('game-intro-screen');
let gameLoopId, currentGame = null, score = 0, frameCount = 0, isGameOver = false;
let pX = 400, pY = 250, entities = [], bullets = [], bricks = [], sDir = {x: 10, y: 0}, sTrail = [], apple = {x: 200, y: 200}, ball = {x: 400, y: 400, vx: 5, vy: -5, r: 6};
let hikePlayer = {x: 400, y: 250}, hikeCamera = {x:0, y:0}, hikeItems = [], hikeTrees = [], keys = {w:false, a:false, s:false, d:false, up:false, down:false, left:false, right:false}, farmGrid = [];

// Real-time clock (seconds). Frame counting assumed 60fps, which broke timing on 120/144Hz screens.
let gameTime = 0, gameDt = 0, lastFrameTs = 0, breathePhase = -1, yogaLastPose = -1;

const SIM_STEP = 1/60;   // physics-style games run 60 simulation steps a second on any screen
let breakerLives = 3, simAcc = 0, sHead = {x: 400, y: 250}, sQueue = [];
let rxState = 0, rxTriggerTime = 0, rxResult = 0, rxTimeoutId = null;

const yogaBgImg = new Image();
yogaBgImg.src = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80";

const gameData = {
    'surge': { title: "NEON SURGE", color: "#45f3ff", btnClass: "btn-surge", desc: "Dodge the incoming red geometric shapes." },
    'snake': { title: "QUANTUM SNAKE", color: "#39ff14", btnClass: "btn-snake", desc: "Collect data nodes to grow your tail." },
    'defend': { title: "PULSE DEFENDER", color: "#ff003c", btnClass: "btn-defend", desc: "Click to shoot incoming anomalies." },
    'breaker': { title: "NEON BREAKER", color: "#ff00ff", btnClass: "btn-breaker", desc: "Bounce ball upward to shatter bricks." },
    'dash': { title: "HYPER DASH", color: "#ffaa00", btnClass: "btn-dash", desc: "Navigate high-speed tunnel." },
    'blast': { title: "BLOCK BLAST", color: "#4d7cff", btnClass: "btn-blast", desc: "Drag the blocks onto the grid. Fill whole rows or columns to blast them away, chain clears for combos. Game ends when no piece fits. (M = mute)" },
    'hike': { title: "ZEN HIKE", color: "#2E8B57", btnClass: "btn-hike", desc: "Wander through the digital forest." },
    'farm': { title: "NEON FARM", color: "#DAA520", btnClass: "btn-farm", desc: "Plant digital seeds, harvest crops." },
    'breathe': { title: "BOX BREATHING", color: "#00ffcc", btnClass: "btn-breathe", desc: "Follow expanding and contracting circle." },
    'yoga': { title: "DESK YOGA", color: "#ff66b2", btnClass: "btn-yoga", desc: "Follow on-screen stretch patterns." },
    'reaction': { title: "NEON REFLEX", color: "#ffffff", btnClass: "btn-reaction", desc: "Test your speed. Click the exact moment the screen turns green!" }
};

function openArcade() { isArcadeActive = true; modal.style.display = 'flex'; setTimeout(() => modal.style.opacity = '1', 10); ui.style.opacity = '0'; showMenu(); }
function closeArcade() { nukeMemory(); gameOverScreen.style.display = 'none'; modal.style.opacity = '0'; setTimeout(() => modal.style.display = 'none', 500); ui.style.opacity = '1'; isArcadeActive = false; }
function showMenu() { nukeMemory(); gameOverScreen.style.display = 'none'; document.getElementById('game-container').style.display = 'none'; document.getElementById('arcade-view').style.display = 'flex'; document.getElementById('back-to-menu-btn').style.display = 'none'; document.body.style.cursor = 'default'; }

function nukeMemory() { 
    cancelAnimationFrame(gameLoopId); 
    currentGame = null; isGameOver = false; entities = []; bullets = []; sTrail = []; bricks = []; hikeItems = []; farmGrid = []; 
    if (typeof blast !== 'undefined' && blast) { clearTimeout(blast.overTimer); blast = null; }
    clearTimeout(rxTimeoutId); rxState = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
}

function prepareGame(gameId) {
    nukeMemory(); gameOverScreen.style.display = 'none'; document.getElementById('arcade-view').style.display = 'none'; document.getElementById('game-container').style.display = 'flex'; document.getElementById('back-to-menu-btn').style.display = 'block';
    const data = gameData[gameId]; currentGame = gameId; introScreen.style.display = 'flex'; canvas.style.display = 'none'; document.getElementById('game-score').style.display = 'none';
    document.getElementById('intro-title').innerText = data.title; document.getElementById('intro-title').style.color = data.color; document.getElementById('intro-desc').innerText = data.desc;
    document.getElementById('start-game-btn').className = `arcade-btn font-mono ${data.btnClass}`;
}

function startGameReal() {
    introScreen.style.display = 'none'; canvas.style.display = 'block'; document.getElementById('game-score').style.display = 'block'; canvas.style.borderColor = gameData[currentGame].color;
    cancelAnimationFrame(gameLoopId);
    entities = []; bullets = []; bricks = []; sTrail = []; sQueue = []; hikeItems = []; hikeTrees = []; farmGrid = [];
    keys.up = keys.down = keys.left = keys.right = false; simAcc = 0;
    score = 0; frameCount = 0; pX = 400; pY = 250; isGameOver = false;
    gameTime = 0; gameDt = 0; lastFrameTs = performance.now(); breathePhase = -1; yogaLastPose = -1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    SFX.unlock();
    if(currentGame === 'snake') { sDir = {x: 10, y: 0}; sQueue = []; sHead = {x: 400, y: 250}; for(let i=0; i<5; i++) sTrail.push({x: sHead.x - i*10, y: sHead.y}); apple = spawnApple(); } 
    else if(currentGame === 'breaker') { ball = {x: 400, y: 300, vx: 3.2, vy: 3.2, r: 6}; breakerLives = 3; for(let r=0; r<4; r++) for(let c=0; c<10; c++) bricks.push({x: c*75 + 25, y: r*30 + 30, w: 70, h: 20, active: true}); } 
    else if(currentGame === 'blast') { initBlast(); } else if(currentGame === 'hike') { initHike(); } else if(currentGame === 'farm') { initFarm(); }
    else if(currentGame === 'reaction') { initReaction(); }
    gameLoopId = requestAnimationFrame(gameRouter);
}

function gameOver(customMessage = "SESSION ENDED") { 
    isGameOver = true; cancelAnimationFrame(gameLoopId); if (currentGame !== 'blast' && typeof SFX !== 'undefined') SFX.gameOver(); document.getElementById('game-over-title').innerText = customMessage; document.getElementById('game-over-title').style.color = gameData[currentGame].color; document.getElementById('final-score').innerText = "FINAL SCORE: " + score; 
    document.getElementById('retry-btn-dynamic').className = `arcade-btn font-mono ${gameData[currentGame].btnClass}`; gameOverScreen.style.display = 'flex'; 
}
function retryGame() { gameOverScreen.style.display = 'none'; startGameReal(); }

canvas.addEventListener('mousemove', (e) => { if(!isGameOver && introScreen.style.display !== 'flex'){ const r = canvas.getBoundingClientRect(); pX = (e.clientX - r.left) * (canvas.width / r.width); pY = (e.clientY - r.top) * (canvas.height / r.height); } });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if(!isGameOver && introScreen.style.display !== 'flex'){ const r = canvas.getBoundingClientRect(); pX = (e.touches[0].clientX - r.left) * (canvas.width / r.width); pY = (e.touches[0].clientY - r.top) * (canvas.height / r.height); } }, {passive: false});

canvas.addEventListener('mousedown', (e) => { 
    if(!isGameOver && introScreen.style.display !== 'flex'){ 
        const r=canvas.getBoundingClientRect(), mx=(e.clientX-r.left)*(800/r.width), my=(e.clientY-r.top)*(500/r.height); 
        if(currentGame==='defend'){const angle=Math.atan2(my-250,mx-400);bullets.push({x:400,y:250,vx:Math.cos(angle)*10,vy:Math.sin(angle)*10});} 
        if(currentGame==='farm'){clickFarm(mx,my);} 
        if(currentGame==='reaction'){clickReaction();}
    } 
});

const SNAKE_KEYS = { w: [0,-10], arrowup: [0,-10], s: [0,10], arrowdown: [0,10], a: [-10,0], arrowleft: [-10,0], d: [10,0], arrowright: [10,0] };
function queueSnakeDir(x, y) {
    const last = sQueue.length ? sQueue[sQueue.length - 1] : sDir;
    if ((x !== 0 && last.x !== 0) || (y !== 0 && last.y !== 0)) return;    // no reversing, no repeating
    if (sQueue.length < 3) sQueue.push({x, y});
}
function spawnApple() {
    for (let t = 0; t < 200; t++) {
        const a = {x: Math.floor(Math.random()*79)*10, y: Math.floor(Math.random()*49)*10};
        if (!sTrail.some(s => s.x === a.x && s.y === a.y)) return a;
    }
    return {x: 0, y: 0};
}
window.addEventListener('keydown', (e) => {
    if (isGameOver || !isArcadeActive || introScreen.style.display === 'flex') return;
    const k = e.key.toLowerCase();
    if (!(k in SNAKE_KEYS)) return;
    e.preventDefault();                                    // arrow keys must not scroll the page behind the game
    if (k === 'w' || k === 'arrowup') keys.up = true;
    if (k === 's' || k === 'arrowdown') keys.down = true;
    if (k === 'a' || k === 'arrowleft') keys.left = true;
    if (k === 'd' || k === 'arrowright') keys.right = true;
    if (currentGame === 'snake') queueSnakeDir(...SNAKE_KEYS[k]);
});
window.addEventListener('keyup', (e) => { const k=e.key.toLowerCase(); if(k==='w'||k==='arrowup')keys.up=false;if(k==='s'||k==='arrowdown')keys.down=false;if(k==='a'||k==='arrowleft')keys.left=false;if(k==='d'||k==='arrowright')keys.right=false; });
window.addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = false; });

// Touch: drag to steer / move; swipe to turn the snake.
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
    if (isGameOver || introScreen.style.display === 'flex') return;
    const t = e.touches[0], r = canvas.getBoundingClientRect();
    touchStart = {x: t.clientX, y: t.clientY};
    pX = (t.clientX - r.left) * (canvas.width / r.width); pY = (t.clientY - r.top) * (canvas.height / r.height);
}, {passive: true});
canvas.addEventListener('touchmove', (e) => {
    if (currentGame === 'snake' && touchStart && e.touches[0]) {
        const dx = e.touches[0].clientX - touchStart.x, dy = e.touches[0].clientY - touchStart.y;
        if (Math.hypot(dx, dy) > 24) {
            if (Math.abs(dx) > Math.abs(dy)) queueSnakeDir(dx > 0 ? 10 : -10, 0); else queueSnakeDir(0, dy > 0 ? 10 : -10);
            touchStart = {x: e.touches[0].clientX, y: e.touches[0].clientY};
        }
    }
    if (currentGame === 'hike' && e.touches[0]) {      // finger = where to walk
        const r = canvas.getBoundingClientRect(), tx = (e.touches[0].clientX - r.left) * (canvas.width / r.width), ty = (e.touches[0].clientY - r.top) * (canvas.height / r.height);
        keys.left = tx < 360; keys.right = tx > 440; keys.up = ty < 210; keys.down = ty > 290;
    }
}, {passive: true});
canvas.addEventListener('touchend', () => { touchStart = null; if (currentGame === 'hike') keys.up = keys.down = keys.left = keys.right = false; });

const FRAME_PACED = ['reaction', 'breathe', 'yoga', 'blast'];   // these use real seconds themselves
function paintBackground() {
    ctx.fillStyle = currentGame === 'hike' ? '#1a2e24' : (currentGame === 'farm' ? '#111' : (currentGame === 'snake' ? 'rgba(0,0,0,1)' : (currentGame === 'blast' ? '#0b0c14' : 'rgba(0,0,0,0.3)')));
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function playCurrent() {
    if(currentGame === 'surge') playSurge();
    else if(currentGame === 'snake') playSnake();
    else if(currentGame === 'defend') playDefend();
    else if(currentGame === 'breaker') playBreaker();
    else if(currentGame === 'dash') playDash();
    else if(currentGame === 'blast') playBlast();
    else if(currentGame === 'hike') playHike();
    else if(currentGame === 'farm') playFarm();
    else if(currentGame === 'breathe') playBreathe();
    else if(currentGame === 'yoga') playYoga();
    else if(currentGame === 'reaction') playReaction();
}

function gameRouter() {
    if(!currentGame || isGameOver) return;
    const nowTs = performance.now();
    gameDt = Math.min(0.25, Math.max(0, (nowTs - lastFrameTs) / 1000)); lastFrameTs = nowTs; gameTime += gameDt;   // tab-hidden gaps are clamped

    if (FRAME_PACED.includes(currentGame)) {
        if (currentGame !== 'reaction') paintBackground();
        playCurrent();
        if(!isGameOver) frameCount++;
    } else {
        // Same speed on 60, 120 and 144 Hz screens: advance in fixed 1/60 s steps, draw what the last step drew.
        simAcc += gameDt;
        let steps = 0;
        while (simAcc >= SIM_STEP && steps < 4 && !isGameOver) {
            paintBackground(); playCurrent();
            if (!isGameOver) frameCount++;
            simAcc -= SIM_STEP; steps++;
        }
        if (steps === 4) simAcc = 0;
    }

    if (currentGame === 'breathe' || currentGame === 'yoga') {
        document.getElementById('game-score').innerText = "SESSION TIME: " + formatClock(gameTime);
    } else if (currentGame === 'reaction') {
        document.getElementById('game-score').innerText = rxState === 4 ? "LATEST: " + Math.floor(rxResult) + "ms" : "TESTING...";
    } else {
        document.getElementById('game-score').innerText = "SCORE: " + score + (currentGame === 'breaker' ? "  ·  LIVES: " + breakerLives : "");
    }

    if(!isGameOver) gameLoopId = requestAnimationFrame(gameRouter);
}

function initReaction() { 
    clearTimeout(rxTimeoutId); 
    rxState = 1; 
    rxResult = 0; 
    let delay = 1500 + Math.random() * 3000; 
    rxTimeoutId = setTimeout(() => { 
        rxState = 2; 
        rxTriggerTime = performance.now(); 
    }, delay); 
}

function clickReaction() { 
    if (rxState === 1) { 
        clearTimeout(rxTimeoutId); 
        rxState = 3; 
    } else if (rxState === 2) { 
        rxResult = performance.now() - rxTriggerTime; 
        rxState = 4; 
    } else if (rxState === 3 || rxState === 4) { 
        initReaction(); 
    } 
}

function playReaction() { 
    if (rxState === 1) { 
        ctx.fillStyle = '#ff003c'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("WAIT FOR GREEN...", 400, 250); 
    } else if (rxState === 2) { 
        ctx.fillStyle = '#39ff14'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#000'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("CLICK NOW!", 400, 250); 
    } else if (rxState === 3) { 
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#ff003c'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText("TOO SOON!", 400, 230); 
        ctx.fillStyle = '#aaa'; ctx.font = '16px monospace'; ctx.fillText("Click anywhere to try again", 400, 270); 
    } else if (rxState === 4) { 
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        ctx.fillStyle = '#45f3ff'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
        ctx.fillText(Math.floor(rxResult) + " ms", 400, 230); 
        ctx.fillStyle = '#aaa'; ctx.font = '16px monospace'; ctx.fillText("Click anywhere to try again", 400, 280); 
    } 
}

const yogaPoses = [
    {name: "NECK ROLLS", desc: "Slowly roll your neck in gentle circles."},
    {name: "SHOULDER SHRUGS", desc: "Lift shoulders to ears, hold, and drop."},
    {name: "WRIST STRETCH", desc: "Extend arm, gently pull fingers back."},
    {name: "SEATED TWIST", desc: "Turn torso to the right, then switch left."},
    {name: "CHEST OPENER", desc: "Clasp hands behind your back and lift."}
];

function drawYogaAvatar(poseIndex, progress, time) {
    ctx.strokeStyle = '#ff66b2'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let cx = 400, cy = 350; 
    let headY = cy - 120, shoulderY = cy - 80, pelvisY = cy + 20;

    ctx.beginPath();
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx-40, pelvisY+40); ctx.lineTo(cx-20, pelvisY+50); 
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx+40, pelvisY+40); ctx.lineTo(cx+20, pelvisY+50); 
    ctx.moveTo(cx, pelvisY); ctx.lineTo(cx, shoulderY); 

    if (poseIndex === 0) { 
        let hx = cx + Math.cos(time * 0.05) * 15;
        let hy = headY + Math.sin(time * 0.05) * 15;
        ctx.arc(hx, hy, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-30, cy-40); ctx.lineTo(cx-15, cy); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+30, cy-40); ctx.lineTo(cx+15, cy);
    } 
    else if (poseIndex === 1) { 
        let sY = shoulderY - Math.abs(Math.sin(time * 0.05) * 20);
        ctx.arc(cx, headY, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx, sY); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx-35, cy-20); ctx.lineTo(cx-20, cy+20); 
        ctx.moveTo(cx, sY); ctx.lineTo(cx+35, cy-20); ctx.lineTo(cx+20, cy+20);
    } 
    else if (poseIndex === 2) { 
        ctx.arc(cx, headY, 22, 0, Math.PI*2);
        let armSwitch = Math.floor(progress * 2); 
        if (armSwitch === 0) {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-90, shoulderY); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+50, shoulderY); ctx.lineTo(cx-80, shoulderY+10); 
        } else {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+90, shoulderY); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-50, shoulderY); ctx.lineTo(cx+80, shoulderY+10); 
        }
    } 
    else if (poseIndex === 3) { 
        ctx.arc(cx, headY, 22, 0, Math.PI*2);
        let twistSwitch = Math.floor(progress * 2); 
        if (twistSwitch === 0) {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+60, cy-40); ctx.lineTo(cx+40, cy+10); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-40, cy-40); 
        } else {
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-60, cy-40); ctx.lineTo(cx-40, cy+10); 
            ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+40, cy-40); 
        }
    } 
    else if (poseIndex === 4) { 
        ctx.arc(cx, headY-10, 22, 0, Math.PI*2); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx-40, cy-20); ctx.lineTo(cx-10, cy+30); 
        ctx.moveTo(cx, shoulderY); ctx.lineTo(cx+40, cy-20); ctx.lineTo(cx+10, cy+30); 
    }
    ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
}

function playYoga() {
    if (yogaBgImg && yogaBgImg.complete && yogaBgImg.naturalWidth > 0) {   // a failed (offline) load must not break every frame
        ctx.globalAlpha = 0.25;
        ctx.drawImage(yogaBgImg, 0, 0, 800, 500);
        ctx.globalAlpha = 1.0;
    }

    const st = yogaAt(gameTime);
    const poseIndex = st.index, poseProgress = st.progress, pose = yogaPoses[poseIndex];
    if (poseIndex !== yogaLastPose) { if (yogaLastPose !== -1) SFX.soft(SFX.midi(60 + poseIndex * 2)); yogaLastPose = poseIndex; }

    drawYogaAvatar(poseIndex, poseProgress, gameTime * 60);   // avatar wobble speed is per second now, not per frame

    ctx.fillStyle = '#ff66b2'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
    ctx.fillText(pose.name, 400, 100);
    ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
    ctx.fillText(pose.desc, 400, 140);
    
    ctx.fillStyle = 'rgba(255, 102, 178, 0.2)'; ctx.fillRect(200, 440, 400, 10);
    ctx.fillStyle = '#ff66b2'; ctx.fillRect(200, 440, 400 * poseProgress, 10);
    ctx.font = '12px monospace'; ctx.fillStyle = '#fff';
    ctx.fillText("Next pose in: " + st.remaining + "s", 400, 470);
}

// ---- Time helpers (pure, so they are unit-tested) ----
const BREATHE_PHASE_SECONDS = 4;           // box breathing: 4s in, 4s hold, 4s out, 4s hold
const YOGA_POSE_SECONDS = 10;
const BREATHE_NAMES = ["INHALE", "HOLD", "EXHALE", "HOLD"];

function formatClock(sec) {
    const s = Math.floor(sec);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function breatheAt(t) {
    const cycle = BREATHE_PHASE_SECONDS * 4;
    const inCycle = t % cycle;
    const phase = Math.floor(inCycle / BREATHE_PHASE_SECONDS);
    const phaseT = inCycle - phase * BREATHE_PHASE_SECONDS;
    const progress = phaseT / BREATHE_PHASE_SECONDS;
    return { phase, progress, remaining: Math.max(1, Math.ceil(BREATHE_PHASE_SECONDS - phaseT)), cycles: Math.floor(t / cycle), name: BREATHE_NAMES[phase] };
}
function yogaAt(t) {
    return {
        index: Math.floor(t / YOGA_POSE_SECONDS) % yogaPoses.length,
        progress: (t % YOGA_POSE_SECONDS) / YOGA_POSE_SECONDS,
        remaining: Math.max(1, Math.ceil(YOGA_POSE_SECONDS - (t % YOGA_POSE_SECONDS)))
    };
}

function playBreathe() {
    const st = breatheAt(gameTime);
    const ease = x => 0.5 - Math.cos(x * Math.PI) / 2;
    let radius = 50;
    if (st.phase === 0) radius = 50 + 100 * ease(st.progress);
    else if (st.phase === 1) radius = 150;
    else if (st.phase === 2) radius = 150 - 100 * ease(st.progress);

    if (st.phase !== breathePhase) {
        if (breathePhase !== -1) {
            const f = [392, 440, 330, 294][st.phase];
            SFX.soft(f, st.phase === 0 ? f * 1.25 : (st.phase === 2 ? f * 0.8 : undefined));
        }
        breathePhase = st.phase;
    }

    // the "box": a dot travels one side per phase (up, across, down, back)
    const L = 220, T = 70, R = 580, B = 430;
    ctx.strokeStyle = 'rgba(0,255,204,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(L, T, R - L, B - T);
    const corners = [[L, B], [L, T], [R, T], [R, B], [L, B]];
    const a = corners[st.phase], b = corners[st.phase + 1];
    ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * st.progress, a[1] + (b[1] - a[1]) * st.progress, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffcc'; ctx.fill();

    ctx.beginPath(); ctx.arc(400, 250, radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,255,204,0.2)'; ctx.fill();
    ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '24px monospace'; ctx.fillText(st.name, 400, 240);
    ctx.font = '16px monospace'; ctx.fillStyle = '#00ffcc'; ctx.fillText(String(st.remaining), 400, 272);
    ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('BREATHS: ' + st.cycles, 400, 460);
    ctx.textBaseline = 'alphabetic';
}
function playSurge() { ctx.beginPath(); ctx.arc(pX, pY, 8, 0, Math.PI*2); ctx.fillStyle='#45f3ff'; ctx.fill(); if(frameCount%Math.max(26,56-Math.floor(score/120))===0) entities.push({x:Math.random()<0.5?-20:820,y:Math.random()*500,s:20,vx:(Math.random()<0.5?1:-1)*(Math.random()*1.8+1.2+Math.min(2,score/1500))}); for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x+=e.vx;ctx.fillStyle='#ff003c';ctx.fillRect(e.x,e.y,e.s,e.s);if(Math.hypot(pX-(e.x+e.s/2),pY-(e.y+e.s/2))<14){gameOver();return;}if(e.x<-50||e.x>850)entities.splice(i,1);} score++; }
function playSnake() {
    if (frameCount % Math.max(4, 6 - Math.floor(score / 500)) === 0) {
        if (sQueue.length) sDir = sQueue.shift();
        sHead.x += sDir.x; sHead.y += sDir.y;
        sTrail.unshift({x: sHead.x, y: sHead.y}); sTrail.pop();
        if (sHead.x < 0 || sHead.x >= 800 || sHead.y < 0 || sHead.y >= 500 || sTrail.slice(1).some(s => s.x === sHead.x && s.y === sHead.y)) { gameOver(); return; }
        if (sHead.x === apple.x && sHead.y === apple.y) { if (typeof SFX !== 'undefined') SFX.eat(); score += 100; sTrail.push({...sTrail[sTrail.length-1]}); apple = spawnApple(); }
    }
    ctx.fillStyle = '#ff003c'; ctx.fillRect(apple.x, apple.y, 10, 10);
    ctx.fillStyle = '#39ff14'; sTrail.forEach(s => ctx.fillRect(s.x, s.y, 10, 10));
}
function playDefend() { ctx.beginPath();ctx.arc(400,250,15,0,Math.PI*2);ctx.fillStyle='#45f3ff';ctx.fill(); if(frameCount%Math.max(36,80-Math.floor(score/60))===0){let a=Math.random()*Math.PI*2;entities.push({x:400+Math.cos(a)*450,y:250+Math.sin(a)*450,a:a});} ctx.fillStyle='#fff';for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.x+=b.vx;b.y+=b.vy;ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();if(b.x<0||b.x>800||b.y<0||b.y>500)bullets.splice(i,1);} ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x-=Math.cos(e.a)*(0.55+Math.min(2,score/2500));e.y-=Math.sin(e.a)*(0.55+Math.min(2,score/2500));ctx.fillRect(e.x-10,e.y-10,20,20);if(Math.hypot(e.x-400,e.y-250)<20){gameOver();return;}for(let j=bullets.length-1;j>=0;j--){if(Math.hypot(e.x-bullets[j].x,e.y-bullets[j].y)<15){score+=50;entities.splice(i,1);bullets.splice(j,1);break;}}} }
function playBreaker() { let px=Math.max(0,Math.min(660,pX-70));ctx.fillStyle='#45f3ff';ctx.fillRect(px,470,140,10); ball.x+=ball.vx;ball.y+=ball.vy;if(ball.x<0){ball.x=0;ball.vx=Math.abs(ball.vx);}if(ball.x>800){ball.x=800;ball.vx=-Math.abs(ball.vx);}if(ball.y<0)ball.vy*=-1;if(ball.y>500){breakerLives--;if(breakerLives<=0){gameOver();return;}ball={x:400,y:300,vx:ball.vx>0?3.2:-3.2,vy:3.2,r:6};return;}if(ball.y+ball.r>470&&ball.x>px&&ball.x<px+140){ball.vy=-Math.abs(ball.vy);ball.vx=((ball.x-(px+70))/70)*4.5;} ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#ff00ff';ctx.fill(); ctx.fillStyle='#ff00ff';let ab=0,hit=false;for(let i=0;i<bricks.length;i++){let b=bricks[i];if(b.active){ab++;ctx.fillRect(b.x,b.y,b.w,b.h);if(!hit&&ball.x>b.x&&ball.x<b.x+b.w&&ball.y-ball.r<b.y+b.h&&ball.y+ball.r>b.y){b.active=false;hit=true;ball.vy*=-1;score+=10;if(typeof SFX!=='undefined')SFX.hit();}}}if(ab===0){ball.vx=Math.max(-7,Math.min(7,ball.vx*1.1));ball.vy=Math.max(-7,Math.min(7,ball.vy*1.1));bricks.forEach(b=>b.active=true);} }
function playDash() { ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.moveTo(pX,450);ctx.lineTo(pX-15,480);ctx.lineTo(pX+15,480);ctx.fill(); if(frameCount%(Math.max(22,56-Math.floor(score/200)))===0)entities.push({x:Math.random()*700,y:-20,w:Math.random()*100+50,h:20}); ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.y+=Math.min(7,3+(score/450));ctx.fillRect(e.x,e.y,e.w,e.h);if(pX>e.x+4&&pX<e.x+e.w-4&&455<e.y+e.h&&478>e.y){gameOver();return;}if(e.y>500)entities.splice(i,1);}score++; }
function initHike() { hikePlayer={x:400,y:250};hikeCamera={x:0,y:0};hikeItems=[];hikeTrees=[];for(let i=0;i<100;i++)hikeTrees.push({x:Math.random()*2000-600,y:Math.random()*2000-600,s:Math.random()*20+20});for(let i=0;i<20;i++)hikeItems.push({x:Math.random()*1500-350,y:Math.random()*1500-350,active:true}); }
function playHike() { let s=3;if(keys.up)hikePlayer.y-=s;if(keys.down)hikePlayer.y+=s;if(keys.left)hikePlayer.x-=s;if(keys.right)hikePlayer.x+=s;hikeCamera.x+=(hikePlayer.x-400-hikeCamera.x)*0.1;hikeCamera.y+=(hikePlayer.y-250-hikeCamera.y)*0.1; ctx.save();ctx.translate(-hikeCamera.x,-hikeCamera.y);ctx.fillStyle='#0a1712';hikeTrees.forEach(t=>ctx.fillRect(t.x,t.y,t.s,t.s*1.5));ctx.fillStyle='#45f3ff';hikeItems.forEach(i=>{if(i.active){ctx.beginPath();ctx.arc(i.x,i.y+Math.sin(frameCount*0.05)*5,5,0,Math.PI*2);ctx.fill();if(Math.hypot(hikePlayer.x-i.x,hikePlayer.y-i.y)<20){i.active=false;score+=50;if(typeof SFX!=='undefined')SFX.pickup();}}});ctx.fillStyle='#fff';ctx.fillRect(hikePlayer.x-10,hikePlayer.y-10,20,20);ctx.restore();if(score>=1000)gameOver("PEAK REACHED"); }
function initFarm() { farmGrid=[];for(let c=0;c<5;c++){farmGrid[c]=[];for(let r=0;r<5;r++)farmGrid[c][r]={state:0,timer:0,x:c*80+225,y:r*80+50};} }
function clickFarm(mx,my) { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(mx>cl.x&&mx<cl.x+70&&my>cl.y&&my<cl.y+70){if(cl.state===0){cl.state=1;cl.timer=0;if(typeof SFX!=='undefined')SFX.click();}else if(cl.state===2){cl.state=0;score+=100;if(typeof SFX!=='undefined')SFX.eat();}}} }
function playFarm() { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(cl.state===1){cl.timer++;if(cl.timer>120)cl.state=2;ctx.fillStyle='#2E8B57';}else if(cl.state===2)ctx.fillStyle='#DAA520';else ctx.fillStyle='#222';ctx.fillRect(cl.x,cl.y,70,70);} if(score>=2000)gameOver("HARVEST COMPLETE"); }

if (typeof module !== 'undefined' && module.exports) module.exports = { breatheAt, yogaAt, formatClock };
