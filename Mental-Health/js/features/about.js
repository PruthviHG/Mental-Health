// ==========================================
// --- ABOUT: who built Mindsence, and what it is ---
// To change names or add the project coordinator, edit ABOUT below (an empty coordinator is simply not shown).
// ==========================================
const ABOUT = {
    title: "Mindsence – AI-Powered Mental Health Assistant with Sentiment Analysis",
    summary: "A project synopsis submitted to Visvesvaraya Technological University (VTU) in partial fulfilment of the requirement for the award of the Bachelor of Engineering degree in Computer Science and Engineering.",
    batch: "Project Batch No: B12",
    college: "Dept. of CS&E, JNN College of Engineering (JNNCE), Shivamogga",
    team: [
        { name: "Pruthvi H G", usn: "4JN23CS110" },
        { name: "Punith Patel G P", usn: "4JN23CS111" },
        { name: "Rajath S", usn: "4JN23CS115" },
        { name: "Ruchitha N", usn: "4JN23CS124" }
    ],
    guide: { name: "Mrs. Ashwini S P", quals: "B.E., M.Tech.", role: "Assistant Professor, Dept. of CS&E, JNNCE, Shivamogga" },
    coordinator: { name: "", role: "Project Coordinator" },       // fill in the name to show it
    what: [
        "A private, gentle AI friend you can talk to by typing or by voice, in 14 languages.",
        "Listens to the tone of your voice and the words you use, so replies match how you feel (sentiment analysis).",
        "A safety net that never depends on a model: crisis words get caring words and real helplines first.",
        "Calming rooms, relaxing music and light games to help you reset.",
        "Works with a free local AI or fully on your own device; your account keeps your space private."
    ],
    tech: "Flask (Python) · vanilla JavaScript · WebLLM / Ollama · wav2vec2 voice-emotion model · neural text-to-speech · Three.js",
    note: "Mindsence is a supportive companion, not a doctor or therapist. If you are in danger, contact your local emergency number or a crisis line (tap NEED HELP?)."
};

(function buildAbout() {
    if (typeof document === 'undefined') return;
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

    const modal = el('div', 'about-modal hidden'); modal.id = 'about-modal';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'about-title');
    const card = el('div', 'about-card');
    const L = (k, fb) => { const v = (typeof t === 'function') ? t(k) : undefined; return v !== undefined && v !== k ? v : fb; };
    let x;
    const render = () => {
        card.textContent = '';
        const head = el('div', 'about-head');
        const h = el('h2', 'about-title', L('abHead', 'About Mindsence')); h.id = 'about-title';
        x = el('button', 'about-x', '×'); x.type = 'button'; x.setAttribute('aria-label', L('abClose', 'Close')); x.onclick = close;
        head.append(h, x);
        const sec = (title) => el('div', 'about-sec', title);
        card.append(head, el('p', 'about-project', ABOUT.title), el('p', 'about-text', L('abSummary', ABOUT.summary)),
            el('p', 'about-chip', `${L('abBatch', ABOUT.batch)}  ·  ${L('abCollege', ABOUT.college)}`));

        card.append(sec(L('abTeam', 'Team')));
        const grid = el('div', 'about-grid');
        ABOUT.team.forEach(m => { const c = el('div', 'about-person'); c.append(el('div', 'about-name', m.name), el('div', 'about-sub', m.usn)); grid.appendChild(c); });
        card.append(grid);

        card.append(sec(L('abGuide', 'Guide')));
        const g = el('div', 'about-person wide'); g.append(el('div', 'about-name', `${ABOUT.guide.name}  ${ABOUT.guide.quals}`), el('div', 'about-sub', L('abRole', ABOUT.guide.role)));
        card.append(g);

        if (ABOUT.coordinator && ABOUT.coordinator.name) {
            card.append(sec(L('abCoord', 'Coordinator')));
            const c = el('div', 'about-person wide'); c.append(el('div', 'about-name', ABOUT.coordinator.name), el('div', 'about-sub', ABOUT.coordinator.role));
            card.append(c);
        }

        card.append(sec(L('abWhatH', 'What it does')));
        const ul = el('ul', 'about-list'); (L('abW', ABOUT.what)).forEach(tx => ul.appendChild(el('li', '', tx))); card.append(ul);
        card.append(sec(L('abBuiltH', 'Built with')), el('p', 'about-text', ABOUT.tech), el('p', 'about-note', L('abNote', ABOUT.note)));
    };
    modal.appendChild(card); document.body.appendChild(modal);
    document.addEventListener('ms-lang', () => { const wasOpen = !modal.classList.contains('hidden'); render(); if (wasOpen) x.focus(); });

    const close = () => { if (modal.classList.contains('hidden')) return; modal.classList.add('hidden'); if (typeof nav !== 'undefined') nav.pop('about'); const b = document.getElementById('about-open'); if (b) b.focus(); };
    const open = () => { modal.classList.remove('hidden'); if (typeof nav !== 'undefined') nav.push('about', () => { modal.classList.add('hidden'); }); x.focus(); };
    window.openAbout = open;
    render();
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    const wire = () => {
        const b = document.getElementById('about-open'); if (b) b.onclick = open;
        const s = document.getElementById('sfx-toggle');
        if (s) {
            const sync = () => { const m = typeof SFX !== 'undefined' && SFX.muted; s.textContent = m ? '🔇' : '🔊'; s.setAttribute('aria-pressed', String(!m)); s.title = m ? 'Sounds off' : 'Sounds on'; };
            s.onclick = () => { if (typeof SFX === 'undefined') return; const m = SFX.toggleMute(); try { localStorage.setItem('mindsence_sfx_muted', m ? '1' : '0'); } catch (e) { /* ignore */ } sync(); if (!m) SFX.click(); };
            sync();
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
