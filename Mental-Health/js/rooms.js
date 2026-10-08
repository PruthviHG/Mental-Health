// ==========================================
// --- EXTENDED ROOMS GALLERY LOGIC ---
// ==========================================
const roomsData = {
    "golden hour": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208089_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208105_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208106_large.mp4", "https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/208649_large.mp4"],
    "study": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/0f661a896986d20c078fbac8b0c136508de406bc/videos/130878-748595919.mp4"],
    "scary": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/136334-764387851.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/dark.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/dark1.mp4"],
    "classic": [""],
    "lofi": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/270983_large.mp4"],
    "bath": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/0f661a896986d20c078fbac8b0c136508de406bc/videos/205001-926015670_medium.mp4"],
    "treehouse": ["https://raw.githubusercontent.com/PruthviHG/lofi-website/09cbaa357cec9ea4b16b858429265ef8c4230494/videos/205634-927347905.mp4", "https://raw.githubusercontent.com/PruthviHG/Mental-Health/8efb11290d8e58f42d062d0444d791e6071424e7/assets/tree.mp4"]
};

const dynamicRooms = {
    "space": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/space?ref=abecb14840be3498a1cfa284b50fe2c8e633e208",
    "nature": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/nature?ref=66d6789b1c439ce2787648c92f633e3908e3b54c",
    "rain": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/rain?ref=ce97064825d2e8d1a82c1b24a31414cf3bb3c743",
    "anime": "https://api.github.com/repos/PruthviHG/Mental-Health/contents/assets/anime?ref=823439b25045f7b53ca2b6f304b02cefe261d010"
};

const roomsModal = document.getElementById('rooms-modal');
const roomsMenuView = document.getElementById('rooms-menu-view');
const roomsVideoView = document.getElementById('rooms-video-view');
const roomsGalleryGrid = document.getElementById('rooms-gallery-grid');
const roomsVideoPlayer = document.getElementById('rooms-video-player');

let roomsPreloaded = false;
const preloadedBlobs = {};

Object.keys(dynamicRooms).forEach(room => {
    fetch(dynamicRooms[room])
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                roomsData[room] = data.filter(f => f.name.match(/\.(mp4|webm)$/i)).map(f => f.download_url);
                if (roomsPreloaded && roomsData[room].length > 0) {
                    const btn = document.createElement('div'); btn.className = 'room-card'; btn.innerText = room;
                    btn.onclick = () => openSpecificRoom(room, roomsData[room]);
                    roomsGalleryGrid.appendChild(btn);
                    roomsData[room].forEach(async url => {
                        try { const res = await fetch(url); const blob = await res.blob(); preloadedBlobs[url] = URL.createObjectURL(blob); } catch(e) {}
                    });
                }
            }
        }).catch(e => console.log("GitHub API Fetch Error for", room, e));
});

function openRooms() {
    isRoomsActive = true; 
    roomsModal.style.display = 'block'; 
    setTimeout(() => roomsModal.style.opacity = '1', 10);
    
    if(!roomsPreloaded) {
        roomsGalleryGrid.innerHTML = '';
        Object.keys(roomsData).forEach(roomName => {
            if(!roomsData[roomName] || roomsData[roomName].length === 0 || roomsData[roomName][0] === "") return;
            const btn = document.createElement('div'); btn.className = 'room-card'; btn.innerText = roomName;
            btn.onclick = () => openSpecificRoom(roomName, roomsData[roomName]);
            roomsGalleryGrid.appendChild(btn);
        });
        
        const urls = Object.values(roomsData).flat().filter(url => url !== "");
        urls.forEach(async url => {
            try { const res = await fetch(url); const blob = await res.blob(); preloadedBlobs[url] = URL.createObjectURL(blob); } catch(e) {}
        });
        roomsPreloaded = true;
    }
}

function closeRooms() {
    isRoomsActive = false;
    roomsModal.style.opacity = '0'; 
    setTimeout(() => roomsModal.style.display = 'none', 500);
    roomsVideoPlayer.pause();
}

const fireflyCanvas = document.getElementById('firefly-canvas');
const fCtx = fireflyCanvas.getContext('2d');
let fireflies = [];

window.addEventListener('resize', () => { fireflyCanvas.width = window.innerWidth; fireflyCanvas.height = window.innerHeight; });
fireflyCanvas.width = window.innerWidth; fireflyCanvas.height = window.innerHeight;

const fireflyConfigs = {
    "golden hour": { color: "255, 215, 0", glowColor: "255, 215, 0", count: 35, size: 2.5, blur: 12 },
    "study": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 20, size: 1.5, blur: 5 },
    "scary": { color: "5, 5, 5", glowColor: "0, 0, 0", count: 25, size: 3, blur: 8 },
    "lofi": { color: "200, 100, 255", glowColor: "200, 100, 255", count: 40, size: 2, blur: 15 },
    "bath": { color: "173, 216, 230", glowColor: "135, 206, 235", count: 35, size: 2, blur: 12 },
    "treehouse": { color: "144, 238, 144", glowColor: "144, 238, 144", count: 50, size: 2, blur: 10 },
    "space": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 60, size: 1.5, blur: 5 },
    "nature": { color: "144, 238, 144", glowColor: "34, 139, 34", count: 40, size: 2, blur: 10 },
    "rain": { color: "173, 216, 230", glowColor: "70, 130, 180", count: 30, size: 2, blur: 8 },
    "anime": { color: "255, 182, 193", glowColor: "255, 105, 180", count: 45, size: 2, blur: 15 },
    "classic": { color: "255, 255, 255", glowColor: "255, 255, 255", count: 20, size: 1.5, blur: 5 }
};

class Firefly {
    constructor(c) {
        this.x = Math.random() * fireflyCanvas.width; this.y = Math.random() * fireflyCanvas.height;
        this.vx = (Math.random() - 0.5) * 1.5; this.vy = (Math.random() - 0.5) * 1.5;
        this.size = Math.random() * c.size + 1; this.color = c.color; this.glowColor = c.glowColor; this.blur = c.blur;
        this.alpha = Math.random(); this.alphaChange = (Math.random() * 0.02) - 0.01;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if(this.x < 0 || this.x > fireflyCanvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > fireflyCanvas.height) this.vy *= -1;
        this.alpha += this.alphaChange; if(this.alpha <= 0.1 || this.alpha >= 1) this.alphaChange *= -1;
    }
    draw() {
        fCtx.beginPath(); fCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        fCtx.fillStyle = `rgba(${this.color}, ${Math.max(0, this.alpha)})`; fCtx.shadowBlur = this.blur;
        fCtx.shadowColor = `rgba(${this.glowColor}, ${Math.max(0, this.alpha)})`; fCtx.fill(); fCtx.shadowBlur = 0;
    }
}

function animateFireflies() {
    requestAnimationFrame(animateFireflies);
    if(isRoomsActive && !roomsVideoView.classList.contains('r-hidden')) {
        fCtx.clearRect(0, 0, fireflyCanvas.width, fireflyCanvas.height);
        fireflies.forEach(p => { p.update(); p.draw(); });
    }
}
animateFireflies();

let currentRoomSet = [], currentSceneIndex = 0;

function openSpecificRoom(roomName, videoArray) {
    currentRoomSet = videoArray; currentSceneIndex = 0;
    
    fireflies = []; const config = fireflyConfigs[roomName] || { color: "255, 255, 255", glowColor: "255, 255, 255", count: 30, size: 2, blur: 10 };
    for(let i=0; i<config.count; i++) fireflies.push(new Firefly(config));

    roomsVideoPlayer.src = preloadedBlobs[currentRoomSet[0]] || currentRoomSet[0];
    roomsVideoPlayer.play();

    roomsMenuView.classList.remove('r-active'); roomsMenuView.classList.add('r-hidden');
    roomsVideoView.classList.remove('r-hidden'); roomsVideoView.classList.add('r-active');

    if (videoArray.length > 1) document.getElementById('rooms-next-scene-btn').classList.remove('hidden');
    else document.getElementById('rooms-next-scene-btn').classList.add('hidden');
}

document.getElementById('rooms-next-scene-btn').onclick = () => {
    currentSceneIndex = (currentSceneIndex + 1) % currentRoomSet.length;
    roomsVideoPlayer.src = preloadedBlobs[currentRoomSet[currentSceneIndex]] || currentRoomSet[currentSceneIndex];
    roomsVideoPlayer.play();
};

document.getElementById('rooms-back-btn').onclick = () => {
    roomsVideoPlayer.pause(); roomsVideoPlayer.src = ""; fireflies = [];
    roomsVideoView.classList.remove('r-active'); roomsVideoView.classList.add('r-hidden');
    roomsMenuView.classList.remove('r-hidden'); roomsMenuView.classList.add('r-active');
};
