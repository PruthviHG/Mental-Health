// ==========================================
// --- ARCADE LOGIC ---
// ==========================================
const modal = document.getElementById('game-modal'), ui = document.getElementById('main-ui'), canvas = document.getElementById('game-canvas'), ctx = canvas.getContext('2d'), gameOverScreen = document.getElementById('game-over-screen'), introScreen = document.getElementById('game-intro-screen');
let gameLoopId, currentGame = null, score = 0, frameCount = 0, isGameOver = false;
let pX = 400, pY = 250, entities = [], bullets = [], bricks = [], sDir = {x: 10, y: 0}, sTrail = [], apple = {x: 200, y: 200}, ball = {x: 400, y: 400, vx: 5, vy: -5, r: 6};
let hikePlayer = {x: 400, y: 250}, hikeCamera = {x:0, y:0}, hikeItems = [], hikeTrees = [], keys = {w:false, a:false, s:false, d:false, up:false, down:false, left:false, right:false}, farmGrid = [];

let rxState = 0, rxTriggerTime = 0, rxResult = 0, rxTimeoutId = null;

const yogaBgImg = new Image();
yogaBgImg.src = "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80";

const gameData = {
    'surge': { title: "NEON SURGE", color: "#45f3ff", btnClass: "btn-surge", desc: "Dodge the incoming red geometric shapes." },
    'snake': { title: "QUANTUM SNAKE", color: "#39ff14", btnClass: "btn-snake", desc: "Collect data nodes to grow your tail." },
    'defend': { title: "PULSE DEFENDER", color: "#ff003c", btnClass: "btn-defend", desc: "Click to shoot incoming anomalies." },
    'breaker': { title: "NEON BREAKER", color: "#ff00ff", btnClass: "btn-breaker", desc: "Bounce ball upward to shatter bricks." },
    'dash': { title: "HYPER DASH", color: "#ffaa00", btnClass: "btn-dash", desc: "Navigate high-speed tunnel." },
    'blast': { title: "BLOCK BLAST", color: "#8A2BE2", btnClass: "btn-blast", desc: "Drag the 3 pieces onto the 8x8 grid. Fill a full row or column to blast it away. Chain clears for combos. The game ends when no piece fits." },
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
    bbReset(); gameClock.reset(); yogaLastPose = -1; breatheLastPhase = -1;
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
    sfx.unlock(); gameClock.reset(); score = 0; frameCount = 0; pX = 400; pY = 250; isGameOver = false;
    if(currentGame === 'snake') { sDir = {x: 10, y: 0}; for(let i=0; i<5; i++) sTrail.push({x: pX - i*10, y: pY}); apple={x:Math.floor(Math.random()*79)*10, y:Math.floor(Math.random()*49)*10}; } 
    else if(currentGame === 'breaker') { ball = {x: 400, y: 300, vx: 5, vy: 5, r: 6}; for(let r=0; r<6; r++) for(let c=0; c<10; c++) bricks.push({x: c*75 + 25, y: r*30 + 30, w: 70, h: 20, active: true}); } 
    else if(currentGame === 'blast') { initBlast(); } else if(currentGame === 'hike') { initHike(); } else if(currentGame === 'farm') { initFarm(); }
    else if(currentGame === 'reaction') { initReaction(); }
    gameLoopId = requestAnimationFrame(gameRouter);
}

function gameOver(customMessage = "SESSION ENDED") { 
    isGameOver = true; cancelAnimationFrame(gameLoopId); document.getElementById('game-over-title').innerText = customMessage; document.getElementById('game-over-title').style.color = gameData[currentGame].color; document.getElementById('final-score').innerText = "FINAL SCORE: " + score; 
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


window.addEventListener('keydown', (e) => { if(!isGameOver && isArcadeActive && introScreen.style.display !== 'flex'){ const k=e.key.toLowerCase(); if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){if(k==='w'||k==='arrowup')keys.up=true;if(k==='s'||k==='arrowdown')keys.down=true;if(k==='a'||k==='arrowleft')keys.left=true;if(k==='d'||k==='arrowright')keys.right=true;} if(currentGame==='snake'){if(keys.up&&sDir.y===0)sDir={x:0,y:-10};if(keys.down&&sDir.y===0)sDir={x:0,y:10};if(keys.left&&sDir.x===0)sDir={x:-10,y:0};if(keys.right&&sDir.x===0)sDir={x:10,y:0};} } });
window.addEventListener('keyup', (e) => { const k=e.key.toLowerCase(); if(k==='w'||k==='arrowup')keys.up=false;if(k==='s'||k==='arrowdown')keys.down=false;if(k==='a'||k==='arrowleft')keys.left=false;if(k==='d'||k==='arrowright')keys.right=false; });

// Real-time clock: advances by wall-clock milliseconds (not frames), so timers are
// identical on 60/120/144Hz screens and never jump after the tab was hidden.
const gameClock = {
    last: 0, ms: 0, dtMs: 16.67,
    reset() { this.last = 0; this.ms = 0; this.dtMs = 16.67; },
    tick(now) {
        if (this.last) { this.dtMs = Math.min(now - this.last, 100); this.ms += this.dtMs; }   // cap = tab-switch safe
        this.last = now;
        return this.ms;
    }
};
const OPAQUE_GAMES = ['hike', 'farm', 'snake', 'breathe', 'yoga', 'blast'];

function gameRouter(now) {
    if(!currentGame || isGameOver) return; 
    gameClock.tick(now || performance.now());
    
    if (currentGame !== 'reaction') {
        ctx.fillStyle = currentGame === 'hike' ? '#1a2e24' : (currentGame === 'farm' ? '#111' : (currentGame === 'blast' ? '#0d0b1a' : (OPAQUE_GAMES.includes(currentGame) ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.3)'))); 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
    }
    
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
    
    if (currentGame === 'breathe' || currentGame === 'yoga') {
        const secs = Math.floor(gameClock.ms / 1000);
        document.getElementById('game-score').innerText = "SESSION TIME: " + String(Math.floor(secs / 60)).padStart(2, '0') + ":" + String(secs % 60).padStart(2, '0');
    } else if (currentGame === 'reaction') {
        document.getElementById('game-score').innerText = rxState === 4 ? "LATEST: " + Math.floor(rxResult) + "ms" : "TESTING...";
    } else {
        document.getElementById('game-score').innerText = "SCORE: " + score; 
    }
    
    if(!isGameOver) { frameCount++; gameLoopId = requestAnimationFrame(gameRouter); }
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

let yogaLastPose = -1;
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
    if (yogaBgImg && yogaBgImg.complete) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(yogaBgImg, 0, 0, 800, 500);
        ctx.globalAlpha = 1.0;
    }

    const poseDurationMs = 10000;   // exactly 10 real seconds per pose
    const t = gameClock.ms;
    let poseIndex = Math.floor(t / poseDurationMs) % yogaPoses.length;
    let poseProgress = (t % poseDurationMs) / poseDurationMs;
    let pose = yogaPoses[poseIndex];
    if (poseIndex !== yogaLastPose) { if (yogaLastPose !== -1) sfx.chime(); yogaLastPose = poseIndex; }
    
    ctx.textBaseline = 'alphabetic';
    drawYogaAvatar(poseIndex, poseProgress, t / (1000 / 60));   // animation speed stays as designed

    ctx.fillStyle = '#ff66b2'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
    ctx.fillText(pose.name, 400, 100);
    ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
    ctx.fillText(pose.desc, 400, 140);
    
    ctx.fillStyle = 'rgba(255, 102, 178, 0.2)'; ctx.fillRect(200, 440, 400, 10);
    ctx.fillStyle = '#ff66b2'; ctx.fillRect(200, 440, 400 * poseProgress, 10);
    ctx.font = '12px monospace'; ctx.fillStyle = '#fff';
    ctx.fillText("Next pose in: " + Math.max(1, Math.ceil((poseDurationMs - (t % poseDurationMs)) / 1000)) + "s", 400, 470);
}

let breatheLastPhase = -1;
function playBreathe() {
    const PHASE_MS = 4000;                          // classic 4-4-4-4 box breathing, real seconds
    const t = gameClock.ms;
    const phase = Math.floor(t / PHASE_MS) % 4, progress = (t % PHASE_MS) / PHASE_MS;
    const secLeft = Math.max(1, Math.ceil((PHASE_MS - (t % PHASE_MS)) / 1000));
    const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;      // smooth in/out
    let radius = 50, text = "";
    if (phase === 0) { radius = 50 + 100 * ease(progress); text = "INHALE"; }
    else if (phase === 1) { radius = 150; text = "HOLD"; }
    else if (phase === 2) { radius = 150 - 100 * ease(progress); text = "EXHALE"; }
    else { radius = 50; text = "HOLD"; }
    if (phase !== breatheLastPhase) { sfx.breathe(phase); breatheLastPhase = phase; }

    // box outline showing which side of the "box" we are on
    const bx = 250, by = 105, bs = 300;
    const corners = [[bx, by + bs], [bx, by], [bx + bs, by], [bx + bs, by + bs], [bx, by + bs]];
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,255,204,0.15)'; ctx.strokeRect(bx, by, bs, bs);
    const a = [[bx, by + bs], [bx, by], [bx + bs, by], [bx + bs, by + bs]][phase], b = [[bx, by], [bx + bs, by], [bx + bs, by + bs], [bx, by + bs]][phase];
    ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress); ctx.stroke();

    ctx.beginPath(); ctx.arc(400, 255, radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,255,204,0.2)'; ctx.fill(); ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 400, 245); ctx.font = 'bold 28px monospace'; ctx.fillStyle = '#00ffcc'; ctx.fillText(secLeft, 400, 278);
}
function playSurge() { ctx.beginPath(); ctx.arc(pX, pY, 8, 0, Math.PI*2); ctx.fillStyle='#45f3ff'; ctx.fill(); if(frameCount%20===0) entities.push({x:Math.random()<0.5?-20:820,y:Math.random()*500,s:20,vx:(Math.random()<0.5?1:-1)*(Math.random()*4+2)}); for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x+=e.vx;ctx.fillStyle='#ff003c';ctx.fillRect(e.x,e.y,e.s,e.s);if(Math.hypot(pX-e.x,pY-e.y)<15){gameOver();return;}if(e.x<-50||e.x>850)entities.splice(i,1);} score++; }
function playSnake() { if(frameCount%4===0){pX+=sDir.x;pY+=sDir.y;sTrail.unshift({x:pX,y:pY});sTrail.pop();if(pX<0||pX>=800||pY<0||pY>=500||sTrail.slice(1).some(s=>s.x===pX&&s.y===pY)){gameOver();return;}if(Math.abs(pX-apple.x)<10&&Math.abs(pY-apple.y)<10){score+=100;sTrail.push({...sTrail[sTrail.length-1]});apple={x:Math.floor(Math.random()*79)*10,y:Math.floor(Math.random()*49)*10};}} ctx.fillStyle='#ff003c';ctx.fillRect(apple.x,apple.y,10,10);ctx.fillStyle='#39ff14';sTrail.forEach(s=>ctx.fillRect(s.x,s.y,10,10)); }
function playDefend() { ctx.beginPath();ctx.arc(400,250,15,0,Math.PI*2);ctx.fillStyle='#45f3ff';ctx.fill(); if(frameCount%40===0){let a=Math.random()*Math.PI*2;entities.push({x:400+Math.cos(a)*450,y:250+Math.sin(a)*450,a:a});} ctx.fillStyle='#fff';for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.x+=b.vx;b.y+=b.vy;ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();if(b.x<0||b.x>800||b.y<0||b.y>500)bullets.splice(i,1);} ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.x-=Math.cos(e.a)*(1+score/1000);e.y-=Math.sin(e.a)*(1+score/1000);ctx.fillRect(e.x-10,e.y-10,20,20);if(Math.hypot(e.x-400,e.y-250)<20){gameOver();return;}for(let j=bullets.length-1;j>=0;j--){if(Math.hypot(e.x-bullets[j].x,e.y-bullets[j].y)<15){score+=50;entities.splice(i,1);bullets.splice(j,1);break;}}} }
function playBreaker() { let px=Math.max(0,Math.min(700,pX-50));ctx.fillStyle='#45f3ff';ctx.fillRect(px,470,100,10); ball.x+=ball.vx;ball.y+=ball.vy;if(ball.x<0||ball.x>800)ball.vx*=-1;if(ball.y<0)ball.vy*=-1;if(ball.y>500){gameOver();return;}if(ball.y+ball.r>470&&ball.x>px&&ball.x<px+100){ball.vy=-Math.abs(ball.vy);ball.vx=((ball.x-(px+50))/50)*6;} ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle='#ff00ff';ctx.fill(); ctx.fillStyle='#ff00ff';let ab=0;for(let i=0;i<bricks.length;i++){let b=bricks[i];if(b.active){ab++;ctx.fillRect(b.x,b.y,b.w,b.h);if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y-ball.r<b.y+b.h&&ball.y+ball.r>b.y){b.active=false;ball.vy*=-1;score+=10;}}}if(ab===0){ball.vx*=1.2;ball.vy*=1.2;bricks.forEach(b=>b.active=true);} }
function playDash() { ctx.fillStyle='#ffaa00';ctx.beginPath();ctx.moveTo(pX,450);ctx.lineTo(pX-15,480);ctx.lineTo(pX+15,480);ctx.fill(); if(frameCount%(Math.max(10,30-Math.floor(score/100)))===0)entities.push({x:Math.random()*700,y:-20,w:Math.random()*100+50,h:20}); ctx.fillStyle='#ff003c';for(let i=entities.length-1;i>=0;i--){let e=entities[i];e.y+=5+(score/200);ctx.fillRect(e.x,e.y,e.w,e.h);if(pX>e.x&&pX<e.x+e.w&&450<e.y+e.h&&480>e.y){gameOver();return;}if(e.y>500)entities.splice(i,1);}score++; }
function initHike() { hikePlayer={x:400,y:250};hikeCamera={x:0,y:0};hikeItems=[];hikeTrees=[];for(let i=0;i<100;i++)hikeTrees.push({x:Math.random()*2000-600,y:Math.random()*2000-600,s:Math.random()*20+20});for(let i=0;i<20;i++)hikeItems.push({x:Math.random()*1500-350,y:Math.random()*1500-350,active:true}); }
function playHike() { let s=3;if(keys.up)hikePlayer.y-=s;if(keys.down)hikePlayer.y+=s;if(keys.left)hikePlayer.x-=s;if(keys.right)hikePlayer.x+=s;hikeCamera.x+=(hikePlayer.x-400-hikeCamera.x)*0.1;hikeCamera.y+=(hikePlayer.y-250-hikeCamera.y)*0.1; ctx.save();ctx.translate(-hikeCamera.x,-hikeCamera.y);ctx.fillStyle='#0a1712';hikeTrees.forEach(t=>ctx.fillRect(t.x,t.y,t.s,t.s*1.5));ctx.fillStyle='#45f3ff';hikeItems.forEach(i=>{if(i.active){ctx.beginPath();ctx.arc(i.x,i.y+Math.sin(frameCount*0.05)*5,5,0,Math.PI*2);ctx.fill();if(Math.hypot(hikePlayer.x-i.x,hikePlayer.y-i.y)<20){i.active=false;score+=50;}}});ctx.fillStyle='#fff';ctx.fillRect(hikePlayer.x-10,hikePlayer.y-10,20,20);ctx.restore();if(score>=1000)gameOver("PEAK REACHED"); }
function initFarm() { farmGrid=[];for(let c=0;c<5;c++){farmGrid[c]=[];for(let r=0;r<5;r++)farmGrid[c][r]={state:0,timer:0,x:c*80+225,y:r*80+50};} }
function clickFarm(mx,my) { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(mx>cl.x&&mx<cl.x+70&&my>cl.y&&my<cl.y+70){if(cl.state===0){cl.state=1;cl.timer=0;}else if(cl.state===2){cl.state=0;score+=100;}}} }
function playFarm() { for(let c=0;c<5;c++)for(let r=0;r<5;r++){let cl=farmGrid[c][r];if(cl.state===1){cl.timer++;if(cl.timer>200)cl.state=2;ctx.fillStyle='#2E8B57';}else if(cl.state===2)ctx.fillStyle='#DAA520';else ctx.fillStyle='#222';ctx.fillRect(cl.x,cl.y,70,70);} if(score>=2000)gameOver("HARVEST COMPLETE"); }


// ==========================================
// --- SOUND EFFECTS (synthesised with WebAudio, no files needed) ---
// ==========================================
const sfx = (() => {
    let ac = null, master = null, delayIn = null;
    const PENTA = [0, 2, 4, 7, 9];                       // major pentatonic: always sounds pleasant
    const note = (base, step) => base * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12);

    function init() {
        if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.55;
        const comp = ac.createDynamicsCompressor();
        master.connect(comp); comp.connect(ac.destination);
        // soft echo "room" so notes shimmer instead of sounding dry
        delayIn = ac.createGain(); delayIn.gain.value = 0.28;
        const d = ac.createDelay(); d.delayTime.value = 0.17;
        const fb = ac.createGain(); fb.gain.value = 0.35;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
        delayIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
        return ac;
    }

    function tone({ f = 440, to = null, dur = 0.2, type = 'sine', vol = 0.3, at = 0, attack = 0.005, echo = true }) {
        if (!init()) return;
        const t = ac.currentTime + at;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master); if (echo) g.connect(delayIn);
        o.start(t); o.stop(t + dur + 0.05);
    }

    function noise({ dur = 0.15, vol = 0.2, from = 6000, to = 800, at = 0, q = 1 }) {
        if (!init()) return;
        const t = ac.currentTime + at, n = Math.floor(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, n, ac.sampleRate), data = buf.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource(); src.buffer = buf;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
        f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(master); src.start(t);
    }

    return {
        unlock: init,
        pick()    { tone({ f: 520, to: 880, dur: 0.09, type: 'sine', vol: 0.22, echo: false }); },
        drop()    { tone({ f: 180, to: 55, dur: 0.18, type: 'sine', vol: 0.55, echo: false });         // thud
                    tone({ f: 900, to: 400, dur: 0.05, type: 'triangle', vol: 0.18, echo: false });    // click
                    noise({ dur: 0.07, vol: 0.12, from: 3000, to: 600 }); },
        invalid() { tone({ f: 170, dur: 0.12, type: 'square', vol: 0.12, echo: false });
                    tone({ f: 130, dur: 0.16, type: 'square', vol: 0.12, at: 0.1, echo: false }); },
        // lines: how many lines cleared at once, combo: consecutive clearing moves
        clear(lines, combo) {
            const steps = Math.min(4 + lines * 2, 12);
            const base = 261.63 * Math.pow(2, Math.min(combo, 6) / 12);   // key rises with the combo
            for (let i = 0; i < steps; i++) {
                const fq = note(base, i);
                tone({ f: fq, dur: 0.32, type: 'triangle', vol: 0.26, at: i * 0.055 });
                tone({ f: fq * 2.005, dur: 0.22, type: 'sine', vol: 0.1, at: i * 0.055 });
            }
            noise({ dur: 0.45, vol: 0.2, from: 1200, to: 9000 });          // whoosh up
            tone({ f: 110, to: 40, dur: 0.35, type: 'sine', vol: 0.5, echo: false });   // boom
            if (lines >= 2 || combo >= 2) {                                // celebratory chord
                [0, 4, 7, 12].forEach((s, k) => tone({ f: base * 2 * Math.pow(2, s / 12), dur: 0.7, type: 'sine', vol: 0.16, at: steps * 0.055 + k * 0.02 }));
            }
        },
        gameover() { [392, 330, 262, 196].forEach((fq, i) => tone({ f: fq, to: fq * 0.97, dur: 0.45, type: 'triangle', vol: 0.3, at: i * 0.18 })); },
        newPieces() { [0, 2, 4].forEach((s, i) => tone({ f: note(392, s), dur: 0.12, type: 'sine', vol: 0.12, at: i * 0.05 })); },
        chime()   { tone({ f: 660, dur: 0.9, type: 'sine', vol: 0.18 }); tone({ f: 990, dur: 1.1, type: 'sine', vol: 0.1, at: 0.12 }); },
        breathe(phase) {   // 0 inhale (rising), 1 hold, 2 exhale (falling), 3 hold
            if (phase === 0) { tone({ f: 220, to: 330, dur: 3.8, type: 'sine', vol: 0.12, attack: 0.5 }); }
            else if (phase === 2) { tone({ f: 330, to: 220, dur: 3.8, type: 'sine', vol: 0.12, attack: 0.3 }); }
            else { tone({ f: 523, dur: 0.8, type: 'sine', vol: 0.08 }); }
        }
    };
})();

// ==========================================
// --- BLOCK BLAST ---
// ==========================================
const BB = { N: 8, CELL: 52, GX: 30, GY: 40, TRAY_X: 490, SLOT_H: 138, PREVIEW: 27 };
const BB_COLORS = ['#ff4d6d', '#ffa62b', '#ffe14d', '#4dff88', '#45f3ff', '#6b8cff', '#c04dff'];
const BB_SHAPES = [
    [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]],
    [[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [[1, 1], [1, 1], [1, 1]],
    [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 1], [0, 1]],
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[0, 0, 1], [0, 0, 1], [1, 1, 1]], [[1, 1, 1], [1, 0, 0], [1, 0, 0]], [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
    [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]], [[0, 1], [1, 1], [0, 1]],
    [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]]
];

let bb = null, bbHandlersOn = false;

function bbReset() { bb = null; }

function initBlast() {
    sfx.unlock();
    bb = {
        grid: Array.from({ length: BB.N }, () => Array(BB.N).fill(null)),
        pieces: [], drag: null, combo: 0, particles: [], floaters: [], flash: [], best: Number(sessionStorage.getItem('bbBest') || 0), shake: 0
    };
    bbDeal();
    if (!bbHandlersOn) {
        canvas.addEventListener('pointerdown', bbDown);
        window.addEventListener('pointermove', bbMove);
        window.addEventListener('pointerup', bbUp);
        window.addEventListener('pointercancel', bbUp);
        bbHandlersOn = true;
    }
}

function bbDeal() {
    bb.pieces = [0, 1, 2].map(() => ({
        shape: BB_SHAPES[Math.floor(Math.random() * BB_SHAPES.length)],
        color: BB_COLORS[Math.floor(Math.random() * BB_COLORS.length)],
        used: false
    }));
    // never hand out a hopeless set when the board is nearly full: guarantee at least one fits
    if (!bb.pieces.some(p => bbAnyFit(p.shape))) {
        const smalls = BB_SHAPES.filter(s => bbAnyFit(s));
        if (smalls.length) bb.pieces[0].shape = smalls[Math.floor(Math.random() * smalls.length)];
    }
    sfx.newPieces();
}

function bbCanPlace(shape, r0, c0) {
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[0].length; c++) {
        if (!shape[r][c]) continue;
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= BB.N || cc >= BB.N || bb.grid[rr][cc]) return false;
    }
    return true;
}
function bbAnyFit(shape) {
    for (let r = 0; r < BB.N; r++) for (let c = 0; c < BB.N; c++) if (bbCanPlace(shape, r, c)) return true;
    return false;
}

function bbPos(e) {
    const rc = canvas.getBoundingClientRect();
    return { x: (e.clientX - rc.left) * (800 / rc.width), y: (e.clientY - rc.top) * (500 / rc.height) };
}
function bbSlotCenter(i) { return { x: BB.TRAY_X + 150, y: BB.GY + BB.SLOT_H * i + BB.SLOT_H / 2 }; }

function bbDown(e) {
    if (currentGame !== 'blast' || isGameOver || !bb || introScreen.style.display === 'flex') return;
    sfx.unlock();
    const p = bbPos(e);
    for (let i = 0; i < 3; i++) {
        const pc = bb.pieces[i]; if (pc.used) continue;
        const ctr = bbSlotCenter(i);
        if (Math.abs(p.x - ctr.x) < 140 && Math.abs(p.y - ctr.y) < BB.SLOT_H / 2) {
            bb.drag = { i, x: p.x, y: p.y, touch: e.pointerType !== 'mouse' };
            try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
            sfx.pick(); e.preventDefault(); return;
        }
    }
}
function bbMove(e) { if (bb && bb.drag) { const p = bbPos(e); bb.drag.x = p.x; bb.drag.y = p.y; } }

// where the dragged piece would land (top-left cell), lifted above the finger on touch
function bbTarget() {
    const d = bb.drag, pc = bb.pieces[d.i], sh = pc.shape;
    const w = sh[0].length * BB.CELL, h = sh.length * BB.CELL;
    const lift = d.touch ? 70 : 0;
    const left = d.x - w / 2, top = d.y - h / 2 - lift;
    return { r: Math.round((top - BB.GY) / BB.CELL), c: Math.round((left - BB.GX) / BB.CELL), left, top };
}

function bbUp() {
    if (!bb || !bb.drag) return;
    const t = bbTarget(), pc = bb.pieces[bb.drag.i];
    bb.drag = null;
    if (isGameOver || !bbCanPlace(pc.shape, t.r, t.c)) { if (t.c > -3 && t.c < BB.N + 1) sfx.invalid(); return; }

    let cells = 0;
    pc.shape.forEach((row, r) => row.forEach((v, c) => { if (v) { bb.grid[t.r + r][t.c + c] = pc.color; cells++; } }));
    pc.used = true; score += cells; sfx.drop(); bb.shake = 4;

    // find full rows / columns
    const rows = [], cols = [];
    for (let i = 0; i < BB.N; i++) {
        if (bb.grid[i].every(Boolean)) rows.push(i);
        if (bb.grid.every(row => row[i])) cols.push(i);
    }
    const lines = rows.length + cols.length;
    if (lines) {
        bb.combo++;
        const gained = lines * 10 * lines + (bb.combo - 1) * 10;
        score += gained;
        const doomed = new Set();
        rows.forEach(r => { for (let c = 0; c < BB.N; c++) doomed.add(r * 8 + c); });
        cols.forEach(c => { for (let r = 0; r < BB.N; r++) doomed.add(r * 8 + c); });
        doomed.forEach(k => {
            const r = Math.floor(k / 8), c = k % 8, col = bb.grid[r][c];
            for (let n = 0; n < 5; n++) bb.particles.push({
                x: BB.GX + c * BB.CELL + BB.CELL / 2, y: BB.GY + r * BB.CELL + BB.CELL / 2,
                vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.7) * 420, life: 0.8 + Math.random() * 0.4, age: 0, col, s: 3 + Math.random() * 5
            });
            bb.flash.push({ r, c, age: 0 });
            bb.grid[r][c] = null;
        });
        const label = (lines > 1 ? lines + " LINES! " : "") + (bb.combo > 1 ? "COMBO x" + bb.combo : "+" + gained);
        bb.floaters.push({ x: 30 + 208, y: 40 + 208, text: label, age: 0 });
        bb.shake = 10 + lines * 3;
        sfx.clear(lines, bb.combo);
    } else {
        bb.combo = 0;
    }

    if (bb.pieces.every(p => p.used)) bbDeal();
    if (bb.pieces.every(p => p.used || !bbAnyFit(p.shape))) {
        bb.best = Math.max(bb.best, score); try { sessionStorage.setItem('bbBest', bb.best); } catch (_) {}
        setTimeout(() => { if (currentGame === 'blast') { sfx.gameover(); gameOver("NO MOVES LEFT"); } }, 700);
    }
}

function bbBlock(x, y, s, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, s - 2, s - 2, s * 0.16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.roundRect(x + 4, y + 4, s - 8, (s - 8) * 0.38, s * 0.1); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + 3, y + s - 7, s - 6, 4);
    ctx.globalAlpha = 1;
}

function playBlast() {
    if (!bb) return;
    const dt = Math.min(0.05, 1 / 60 * (gameClock.dtMs ? gameClock.dtMs / 16.67 : 1));
    const N = BB.N, C = BB.CELL;
    ctx.save();
    if (bb.shake > 0.3) { ctx.translate((Math.random() - 0.5) * bb.shake, (Math.random() - 0.5) * bb.shake); bb.shake *= 0.86; }

    // board
    ctx.fillStyle = '#17142b'; ctx.beginPath(); ctx.roundRect(BB.GX - 6, BB.GY - 6, N * C + 12, N * C + 12, 10); ctx.fill();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const x = BB.GX + c * C, y = BB.GY + r * C;
        ctx.fillStyle = ((r >> 1) + (c >> 1)) % 2 ? '#201b3d' : '#1b1736';
        ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
        if (bb.grid[r][c]) bbBlock(x, y, C, bb.grid[r][c]);
    }

    // drag preview: ghost + highlight of lines that would clear
    let tgt = null, ok = false;
    if (bb.drag) {
        tgt = bbTarget(); const pc = bb.pieces[bb.drag.i];
        ok = bbCanPlace(pc.shape, tgt.r, tgt.c);
        if (ok) {
            const sim = bb.grid.map(row => row.slice());
            pc.shape.forEach((row, r) => row.forEach((v, c) => { if (v) sim[tgt.r + r][tgt.c + c] = 1; }));
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            for (let i = 0; i < N; i++) {
                if (sim[i].every(Boolean)) ctx.fillRect(BB.GX, BB.GY + i * C, N * C, C);
                if (sim.every(row => row[i])) ctx.fillRect(BB.GX + i * C, BB.GY, C, N * C);
            }
            pc.shape.forEach((row, r) => row.forEach((v, c) => { if (v) bbBlock(BB.GX + (tgt.c + c) * C, BB.GY + (tgt.r + r) * C, C, pc.color, 0.45); }));
        }
    }

    // clear flashes + particles
    bb.flash = bb.flash.filter(f => (f.age += 0.04) < 1);
    bb.flash.forEach(f => { ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - f.age)})`; ctx.fillRect(BB.GX + f.c * C, BB.GY + f.r * C, C, C); });
    bb.particles = bb.particles.filter(p => (p.age += dt) < p.life);
    bb.particles.forEach(p => {
        p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.s, p.s); ctx.globalAlpha = 1;
    });

    // tray
    ctx.fillStyle = '#17142b'; ctx.beginPath(); ctx.roundRect(BB.TRAY_X, BB.GY - 6, 280, N * C + 12, 10); ctx.fill();
    for (let i = 0; i < 3; i++) {
        const pc = bb.pieces[i]; if (pc.used || (bb.drag && bb.drag.i === i)) continue;
        const ctr = bbSlotCenter(i), s = BB.PREVIEW;
        const w = pc.shape[0].length * s, h = pc.shape.length * s;
        const fits = bbAnyFit(pc.shape);
        pc.shape.forEach((row, r) => row.forEach((v, c) => { if (v) bbBlock(ctr.x - w / 2 + c * s, ctr.y - h / 2 + r * s, s, fits ? pc.color : '#555', fits ? 1 : 0.5); }));
    }
    ctx.fillStyle = '#8a86b5'; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('DRAG PIECES TO THE GRID', BB.TRAY_X + 140, BB.GY + N * C + 2 + 14);
    ctx.fillText('BEST: ' + Math.max(bb.best, score), BB.TRAY_X + 140, 28);

    // dragged piece follows the pointer
    if (bb.drag) {
        const pc = bb.pieces[bb.drag.i];
        const px = ok ? BB.GX + tgt.c * C : tgt.left, py = ok ? BB.GY + tgt.r * C : tgt.top;
        if (!ok) pc.shape.forEach((row, r) => row.forEach((v, c) => { if (v) bbBlock(tgt.left + c * C, tgt.top + r * C, C, pc.color, 0.9); }));
    }

    // floating combo text
    bb.floaters = bb.floaters.filter(f => (f.age += dt) < 1.1);
    bb.floaters.forEach(f => {
        ctx.globalAlpha = Math.max(0, 1 - f.age / 1.1); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#8A2BE2'; ctx.lineWidth = 5;
        ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText(f.text, f.x, f.y - f.age * 60); ctx.fillText(f.text, f.x, f.y - f.age * 60); ctx.globalAlpha = 1;
    });
    ctx.restore();
}
