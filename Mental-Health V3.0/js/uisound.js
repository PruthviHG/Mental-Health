// ==========================================
// --- UI SOUNDS: soft clicks, typing, send/receive. Everywhere (chat, games, rooms). Mute with the speaker button. ---
// ==========================================
(function () {
    const KEY = 'mindsence_sfx_muted';
    try { if (localStorage.getItem(KEY) === '1' && typeof SFX !== 'undefined' && !SFX.muted) SFX.toggleMute(); } catch (e) { /* storage blocked */ }
    const ok = () => typeof SFX !== 'undefined' && !document.hidden;
    const CLICKABLE = 'button, a[href], [role="button"], select, summary, .room-card, .arcade-btn, .rooms-icon-btn, label.music-vol-row';

    document.addEventListener('pointerdown', (e) => {
        if (!ok() || !e.target.closest) return;
        const el = e.target.closest(CLICKABLE);
        if (!el || el.disabled) return;
        if (el.id === 'sendButton') return;                  // the send sound is played on send
        SFX.click();
    }, { passive: true, capture: true });

    let lastKey = 0;
    document.addEventListener('keydown', (e) => {
        if (!ok() || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const t = e.target;
        if (!t || !(t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit)$/.test(t.type)))) return;
        const now = performance.now();
        if (now - lastKey < 28) return;                      // fast typists: never a machine-gun
        lastKey = now;
        SFX.key(e.key === 'Enter' ? 'enter' : (e.key === 'Backspace' || e.key === 'Delete') ? 'back' : 'key');
    }, { passive: true, capture: true });

    // sent / received messages
    window.addEventListener('DOMContentLoaded', () => {
        const box = document.getElementById('chatbox');
        if (!box || typeof MutationObserver === 'undefined') return;
        let ready = false; setTimeout(() => { ready = true; }, 1500);          // not for the greeting at load
        new MutationObserver((list) => {
            if (!ready || !ok()) return;
            for (const m of list) m.addedNodes.forEach((n) => {
                if (!(n.nodeType === 1 && n.classList && n.classList.contains('msg-enter'))) return;
                if (n.classList.contains('justify-end')) SFX.send();
                else if (n.querySelector('.ai-text')) SFX.receive();
            });
        }).observe(box, { childList: true });
    });

    // game actions
    window.addEventListener('DOMContentLoaded', () => {
        const cv = document.getElementById('game-canvas');
        if (cv) cv.addEventListener('mousedown', () => { if (typeof currentGame !== 'undefined' && currentGame === 'defend' && ok()) SFX.shoot(); }, { passive: true });
    });
})();
