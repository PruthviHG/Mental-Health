// ==========================================
// --- BACK BUTTON: closes the game / room / dialog you are in instead of leaving the site ---
// Every overlay pushes one history entry when it opens. Back (browser, phone gesture, mouse button) closes the
// top overlay. On the plain chat screen the first Back asks "press back again to leave"; a second one within
// 2.5 seconds really leaves. Closing an overlay with its own button quietly removes its history entry.
// ==========================================
const nav = (() => {
    const layers = [];            // { id, back }
    let skip = 0;                 // popstate events caused by our own history.back()
    let closingByBack = false;
    let armedUntil = 0, toastEl = null, toastTimer = null;
    const canHistory = typeof history !== 'undefined' && typeof history.pushState === 'function';

    function safePush(state) { try { history.pushState(state, ''); return true; } catch (e) { return false; } }

    function push(id, back) {
        if (!canHistory || layers.some(l => l.id === id)) return;
        if (safePush({ ms: id })) layers.push({ id, back });
    }
    function pop(id) {                                  // the overlay was closed by its own button / code
        if (closingByBack) return;
        const i = layers.findIndex(l => l.id === id);
        if (i < 0) return;
        layers.splice(i, 1);
        skip++; try { history.back(); } catch (e) { skip--; }
    }
    function toast(text) {
        if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'back-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
        toastEl.textContent = text; toastEl.classList.add('show');
        clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl && toastEl.classList.remove('show'), 2300);
    }

    if (canHistory) {
        safePush({ ms: 'home' });                       // the entry Back lands on when nothing is open
        window.addEventListener('popstate', () => {
            if (skip > 0) { skip--; return; }
            const top = layers[layers.length - 1];
            if (top) {
                layers.pop();
                closingByBack = true;
                try { top.back(); } finally { closingByBack = false; }
                return;
            }
            if (Date.now() < armedUntil) { armedUntil = 0; skip++; try { history.back(); } catch (e) { skip--; } return; }   // second Back: leave
            armedUntil = Date.now() + 2500;
            safePush({ ms: 'home' });                   // stay on the page
            toast('Press back again to leave Mindsence');
        });
    }
    return { push, pop, get depth() { return layers.length; } };
})();

// Wrap the existing open/close functions (inline onclick handlers and other scripts call these by name).
(function wireBackButton() {
    const w = window;
    const wrap = (name, fn) => { if (typeof w[name] === 'function') { const orig = w[name]; w[name] = function () { return fn(orig, arguments, this); }; } };

    wrap('openArcade', (orig, a, t) => { if (!isArcadeActive) nav.push('arcade', () => closeArcadeRaw()); return orig.apply(t, a); });
    const closeArcadeRaw = typeof closeArcade === 'function' ? closeArcade : () => {};
    wrap('closeArcade', (orig, a, t) => { nav.pop('game'); nav.pop('arcade'); return orig.apply(t, a); });
    wrap('prepareGame', (orig, a, t) => { nav.push('game', () => showMenu()); return orig.apply(t, a); });
    wrap('showMenu', (orig, a, t) => { nav.pop('game'); return orig.apply(t, a); });

    const closeRoomsRaw = typeof closeRooms === 'function' ? closeRooms : () => {};
    wrap('openRooms', (orig, a, t) => { if (!isRoomsActive) nav.push('rooms', () => closeRoomsRaw()); return orig.apply(t, a); });
    wrap('closeRooms', (orig, a, t) => { nav.pop('scene'); nav.pop('rooms'); return orig.apply(t, a); });
    const backBtn = document.getElementById('rooms-back-btn');
    wrap('openSpecificRoom', (orig, a, t) => { nav.push('scene', () => backBtn && backBtn.click()); return orig.apply(t, a); });
    if (backBtn) backBtn.addEventListener('click', () => nav.pop('scene'));

    wrap('openHelpModal', (orig, a, t) => { nav.push('help', () => closeHelpRaw()); return orig.apply(t, a); });
    const closeHelpRaw = typeof closeHelpModal === 'function' ? closeHelpModal : () => {};
    wrap('closeHelpModal', (orig, a, t) => { nav.pop('help'); return orig.apply(t, a); });
})();
