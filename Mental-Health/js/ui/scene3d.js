// ==========================================
// --- 3D BACKGROUND: your original particle system, unchanged geometry, shape and material ---
// 100 000 points (20 000 on phones) start scattered in a 10-unit box, glide into a sphere of radius 2.5, 60 degree lens at z = 5,
// round-edged cyan points (size 0.012, opacity 0.4, #45f3ff), mouse tilts the cloud, bass makes it swell.
// Added on top, nothing else changed: a steady beat while a YouTube song plays (its sound cannot be read),
// the chat commands "stop the particles" / "particles faster", and a pause while the tab is hidden.
// The motion itself is timed against the real clock (not just "a bit every frame"), so it looks the same
// swell-and-settle "dance" on a 60Hz screen as on a 120Hz one, with a lightly-damped spring (not a flat fade)
// giving the swell a bit of real momentum, closer to how something set moving by a beat actually behaves.
// ==========================================
let scene, camera, renderer, particles_3d;
let bassVelocity = 0;             // spring state for the swell driven by a YouTube song (own-track analyser bypasses this: already a direct signal)
let lastFrameT = null;

let count = window.innerWidth < 768 ? 20000 : 100000;
let positions = new Float32Array(count * 3), targetPositions = new Float32Array(count * 3);
let sceneReady = false;

function init3D() {
    const holder = document.getElementById('canvas-container');
    if (!holder || typeof THREE === 'undefined') return;                 // no WebGL library: plain dark background
    try {
        scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); camera.position.z = 5;
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        holder.appendChild(renderer.domElement);

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
        sceneReady = true;
    } catch (e) { sceneReady = false; }                                   // WebGL unavailable: plain dark background
}

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', (e) => { if (isArcadeActive || isRoomsActive) return; mouseX = (e.clientX / window.innerWidth - 0.5); mouseY = (e.clientY / window.innerHeight - 0.5); }, { passive: true });

let frameSkip = 0, settledFrames = 0;
function animate3D() {
    requestAnimationFrame(animate3D);
    if (!sceneReady || document.hidden || isArcadeActive || isRoomsActive) { lastFrameT = null; return; }
    if (window.fxParticles === false) { if (renderer.domElement.style.visibility !== 'hidden') renderer.domElement.style.visibility = 'hidden'; lastFrameT = null; return; }
    if (renderer.domElement.style.visibility === 'hidden') renderer.domElement.style.visibility = '';
    // While the AI is writing or speaking, draw at half rate so the model gets the processor.
    if ((typeof receiving !== 'undefined' && receiving) && (frameSkip++ & 1)) return;

    // Real elapsed time since the last drawn frame, not "one tick" -- so the swell/settle reads the same
    // whether the screen refreshes at 60Hz or 120Hz. Clamped so coming back from a hidden/throttled tab
    // doesn't suddenly fling the particles forward by several seconds' worth of motion in one jump.
    const nowMs = performance.now();
    const dt = lastFrameT === null ? (1 / 60) : Math.min((nowMs - lastFrameT) / 1000, 0.1);
    lastFrameT = nowMs;

    if (isAudioInitialized && isMusicPlaying && !isTemporarilyMuted) {
        analyser.getByteFrequencyData(dataArray);
        let bassSum = 0; for (let i = 0; i < 10; i++) bassSum += dataArray[i];
        currentBassPulse = ((bassSum / 10) / 255) * 2.0;
        bassVelocity = 0;                                            // real audio is a direct signal, no spring needed
    } else if (typeof ytPlaying !== 'undefined' && ytPlaying && !isTemporarilyMuted) {
        // A YouTube song is playing: its sound cannot be read from here (cross-origin), so swell to a synthetic
        // beat (~112 bpm) instead of a real one -- but its real, reported playback position (not our own wall
        // clock) sets the beat's timing, so it doesn't drift against the actual video on a pause/seek/buffer,
        // and its real, reported volume/mute sets how hard it swells, so turning the song down calms this too.
        const nowSec = nowMs / 1000;
        const t = (typeof window !== 'undefined' && typeof window.ytCurrentTime === 'number')
            ? window.ytCurrentTime + (nowSec - window.ytCurrentTimeAt)      // advance smoothly every frame, resynced on each real update
            : nowSec;
        const vol = (typeof window !== 'undefined' && typeof window.ytVolumeFrac === 'number') ? window.ytVolumeFrac : 1;
        const ph = (t * 112 / 60) % 1;
        const target = (0.2 + 0.75 * Math.exp(-ph * 4.5) + 0.12 * Math.sin(t * 0.9)) * vol;
        // A lightly-damped spring instead of a flat "move 35% of the gap every frame" fade: the pulse has real
        // momentum, so it overshoots and settles a touch on each beat the way something physically set swinging
        // does, rather than snapping meekly toward the target and stopping dead the instant the target does.
        const stiffness = 90, damping = 11;                          // damping a little under critical: a small, musical overshoot, not an oscillating wobble
        const accel = (target - currentBassPulse) * stiffness - bassVelocity * damping;
        bassVelocity += accel * dt;
        currentBassPulse += bassVelocity * dt;
        if (currentBassPulse < 0) { currentBassPulse = 0; bassVelocity = Math.max(bassVelocity, 0); }
    } else {
        bassVelocity = 0;
        currentBassPulse = Math.max(0, currentBassPulse - 2.5 * dt);  // same fade-out rate as before (0.05/frame at 60fps), now framerate-independent
    }

    // The particles converge on the sphere; after they settle (no music pulse) there is nothing to recompute.
    settledFrames = currentBassPulse > 0.01 ? 0 : settledFrames + 1;
    if (settledFrames < 90) {
        const posArr = particles_3d.geometry.attributes.position.array; const totalExplosion = currentBassPulse;
        // Exponential approach to the target at a fixed per-second rate (not a fixed per-frame fraction), so the
        // convergence takes the same real time regardless of frame rate: 1 - 0.9^(dt*60) reduces to the original
        // "10% of the gap per frame" exactly at 60fps, and scales correctly above or below that.
        const lerpAmt = 1 - Math.pow(0.9, dt * 60);
        for (let i = 0; i < count * 3; i++) posArr[i] += ((targetPositions[i] * (1 + totalExplosion)) - posArr[i]) * lerpAmt;
        particles_3d.geometry.attributes.position.needsUpdate = true;
    }
    const sp = window.fxSpeed || 1;
    const rotRate60 = (0.001 + (currentBassPulse * 0.005)) * sp;      // the original numbers were already "per 60fps frame"; scale by real frames-elapsed
    particles_3d.rotation.y += rotRate60 * (dt * 60);
    particles_3d.rotation.x += mouseY * 0.02 * (dt * 60);
    particles_3d.rotation.z += mouseX * 0.02 * (dt * 60);

    renderer.render(scene, camera);
}
init3D(); animate3D();
window.addEventListener('resize', () => {
    if (!sceneReady) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, { passive: true });
