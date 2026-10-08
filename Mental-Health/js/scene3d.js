// ==========================================
// --- 3D BACKGROUND ---
// ==========================================
let scene, camera, renderer, particles_3d;

let count = window.innerWidth < 768 ? 20000 : 100000;
let positions = new Float32Array(count * 3), targetPositions = new Float32Array(count * 3);

function init3D() {
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 10;
        const theta = Math.random() * Math.PI * 2, phi = Math.acos((Math.random() * 2) - 1), r = 2.5;
        if (i % 3 === 0) targetPositions[i] = r * Math.sin(phi) * Math.cos(theta);
        if (i % 3 === 1) targetPositions[i] = r * Math.sin(phi) * Math.sin(theta);
        if (i % 3 === 2) targetPositions[i] = r * Math.cos(phi);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles_3d = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x45f3ff, size: 0.012, transparent: true, opacity: 0.4 }));
    scene.add(particles_3d);
}

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => { if(isArcadeActive || isRoomsActive) return; mouseX = (e.clientX / window.innerWidth - 0.5); mouseY = (e.clientY / window.innerHeight - 0.5); });

function animate3D() {
    requestAnimationFrame(animate3D); 
    if(isArcadeActive || isRoomsActive) return;

    if (isAudioInitialized && isMusicPlaying && !isTemporarilyMuted) {
        analyser.getByteFrequencyData(dataArray);
        let bassSum = 0; for(let i = 0; i < 10; i++) bassSum += dataArray[i];
        currentBassPulse = ((bassSum / 10) / 255) * 2.0; 
    } else { currentBassPulse = Math.max(0, currentBassPulse - 0.05); }
    
    const posArr = particles_3d.geometry.attributes.position.array; let totalExplosion = currentBassPulse; 
    for (let i = 0; i < count * 3; i++) posArr[i] += ((targetPositions[i] * (1 + totalExplosion)) - posArr[i]) * 0.1;
    particles_3d.geometry.attributes.position.needsUpdate = true;
    particles_3d.rotation.y += 0.001 + (currentBassPulse * 0.005); particles_3d.rotation.x += mouseY * 0.02; particles_3d.rotation.z += mouseX * 0.02;
    
    renderer.render(scene, camera);
}
init3D(); animate3D(); 
window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    if (window.innerWidth < 768 && count > 30000) location.reload();
});


