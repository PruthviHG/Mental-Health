// ==========================================
// --- SFX: tiny synth for game sounds (no audio files) ---
// ==========================================
const SFX = (() => {
    let ac = null, master = null, noiseBuf = null;
    let muted = false;

    function ensure() {
        if (!ac) {
            const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
            if (!AC) return null;
            try {
                ac = new AC();
                master = ac.createGain();
                master.gain.value = 0.4;
                const comp = ac.createDynamicsCompressor();   // keeps big combos from clipping
                master.connect(comp); comp.connect(ac.destination);
                noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            } catch (e) { ac = null; return null; }
        }
        if (ac.state === 'suspended') ac.resume();
        return ac;
    }

    function tone({ freq, to, dur = 0.15, type = 'sine', vol = 0.25, delay = 0, attack = 0.006 }) {
        if (muted) return;
        const a = ensure(); if (!a) return;
        const t = a.currentTime + delay;
        const o = a.createOscillator(), g = a.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.05);
    }

    function noise({ dur = 0.1, vol = 0.2, freq = 1000, to, q = 1, type = 'bandpass', delay = 0 }) {
        if (muted) return;
        const a = ensure(); if (!a) return;
        const t = a.currentTime + delay;
        const src = a.createBufferSource(); src.buffer = noiseBuf;
        const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
        f.frequency.setValueAtTime(freq, t);
        if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.05);
    }

    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    const PENTA = [0, 2, 4, 7, 9];                       // major pentatonic: always sounds pleasant

    return {
        unlock: ensure,
        get muted() { return muted; },
        toggleMute() { muted = !muted; return muted; },
        tone, noise, midi,

        // ---- interface sounds: quiet and short, never harsh ----
        click() {                                          // soft glassy tick
            const j = 1 + (Math.random() - 0.5) * 0.08;
            tone({ freq: 880 * j, to: 620 * j, dur: 0.05, type: 'sine', vol: 0.07, attack: 0.004 });
            noise({ dur: 0.025, vol: 0.03, freq: 5000, type: 'highpass' });
        },
        key(kind) {                                        // keyboard "thock", a little different per key
            const j = 1 + (Math.random() - 0.5) * 0.14;
            if (kind === 'enter') { tone({ freq: 210, to: 120, dur: 0.1, type: 'sine', vol: 0.12 }); noise({ dur: 0.04, vol: 0.05, freq: 700, type: 'lowpass' }); return; }
            if (kind === 'back') { tone({ freq: 300 * j, to: 220 * j, dur: 0.04, type: 'sine', vol: 0.05 }); return; }
            tone({ freq: 360 * j, to: 250 * j, dur: 0.045, type: 'triangle', vol: 0.06, attack: 0.003 });
            noise({ dur: 0.022, vol: 0.03, freq: 2200 * j, q: 1.5 });
        },
        send() {                                           // gentle upward whoosh
            tone({ freq: 420, to: 840, dur: 0.12, type: 'sine', vol: 0.08 });
            noise({ dur: 0.12, vol: 0.04, freq: 800, to: 3200, q: 0.7 });
        },
        receive() {                                        // two soft notes, like a message landing
            tone({ freq: midi(79), dur: 0.16, type: 'sine', vol: 0.06 });
            tone({ freq: midi(84), dur: 0.22, type: 'sine', vol: 0.05, delay: 0.09 });
        },
        open() { tone({ freq: 500, to: 760, dur: 0.09, type: 'sine', vol: 0.06 }); },
        close() { tone({ freq: 700, to: 450, dur: 0.09, type: 'sine', vol: 0.05 }); },
        shoot() { tone({ freq: 900, to: 260, dur: 0.09, type: 'triangle', vol: 0.07 }); },
        eat() { tone({ freq: midi(76), dur: 0.08, type: 'sine', vol: 0.09 }); tone({ freq: midi(83), dur: 0.12, type: 'sine', vol: 0.07, delay: 0.05 }); },
        hit() { tone({ freq: 520, to: 330, dur: 0.07, type: 'square', vol: 0.04 }); noise({ dur: 0.04, vol: 0.05, freq: 1800, q: 2 }); },
        grow() { tone({ freq: 300, to: 600, dur: 0.1, type: 'sine', vol: 0.08 }); },

        pickup() { tone({ freq: 520, to: 780, dur: 0.07, type: 'triangle', vol: 0.12 }); },

        place() {                                          // soft "thock"
            tone({ freq: 230, to: 90, dur: 0.14, type: 'sine', vol: 0.4 });
            noise({ dur: 0.07, vol: 0.14, freq: 500, type: 'lowpass' });
            tone({ freq: 1100, dur: 0.03, type: 'square', vol: 0.04 });
        },

        invalid() {
            tone({ freq: 190, to: 130, dur: 0.16, type: 'square', vol: 0.09 });
            tone({ freq: 150, to: 100, dur: 0.18, type: 'square', vol: 0.08, delay: 0.09 });
        },

        // lines cleared at once, combo streak -> rising, sparkly arpeggio
        clear(lines, combo) {
            const base = 60 + Math.min(combo, 7) * 2;
            const n = 4 + Math.min(lines, 4) * 2;
            for (let i = 0; i < n; i++) {
                const deg = PENTA[i % 5] + 12 * Math.floor(i / 5);
                tone({ freq: midi(base + deg), dur: 0.24, type: 'triangle', vol: 0.2, delay: i * 0.055 });
                tone({ freq: midi(base + deg + 12), dur: 0.16, type: 'sine', vol: 0.08, delay: i * 0.055 + 0.02 });
            }
            noise({ dur: 0.38, vol: 0.16, freq: 400, to: 3600, q: 0.8 });                 // whoosh
            tone({ freq: 130, to: 45, dur: 0.32, type: 'sine', vol: 0.34 });                // sub boom
            if (combo >= 2) {                                                              // bell on combos
                const t = n * 0.055;
                tone({ freq: midi(base + 24), dur: 0.7, type: 'sine', vol: 0.12, delay: t });
                tone({ freq: midi(base + 24) * 2.76, dur: 0.45, type: 'sine', vol: 0.05, delay: t });
            }
        },

        perfect() {
            [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
                tone({ freq: midi(72 + s), dur: 0.5, type: 'sine', vol: 0.15, delay: i * 0.07 }));
            noise({ dur: 0.7, vol: 0.12, freq: 2000, to: 8000, q: 2, type: 'highpass', delay: 0.1 });
        },

        gameOver() {
            [67, 63, 60, 55].forEach((n, i) =>
                tone({ freq: midi(n), dur: 0.36, type: 'triangle', vol: 0.2, delay: i * 0.2 }));
            tone({ freq: 90, to: 40, dur: 0.9, type: 'sine', vol: 0.3, delay: 0.5 });
        },

        // calm bowl-like tone for breathing / yoga cues
        soft(freq, to) {
            tone({ freq, to, dur: 1.3, type: 'sine', vol: 0.09, attack: 0.18 });
            tone({ freq: freq / 2, to: to ? to / 2 : undefined, dur: 1.5, type: 'sine', vol: 0.05, attack: 0.25 });
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { SFX };
