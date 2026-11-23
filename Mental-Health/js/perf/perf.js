// Performance page. Numbers come from PERF_DATA (tools/benchmark.js); the analyzer and the critical-situations test run the REAL
// detectors (safety.js, i18n.js, stories.js) in this browser. Animation uses anime.js (animejs.com) when it loads, and falls back
// to plain CSS/Web-Animations when it does not (offline, blocked CDN), so the page always works.
(function () {
    'use strict';
    const D = PERF_DATA, NS = 'http://www.w3.org/2000/svg';
    const $ = (id) => document.getElementById(id);
    const el = (name, attrs, text) => { const n = document.createElementNS(NS, name); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); if (text !== undefined) n.textContent = text; return n; };
    const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
    const fmtMs = (v) => v < 0.1 ? v.toFixed(3) + ' ms' : v < 10 ? v.toFixed(1) + ' ms' : Math.round(v) + ' ms';
    const NAMES = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese' };

    // ---------- motion layer ----------
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const A = () => (window.anime && typeof window.anime.animate === 'function') ? window.anime : null;
    const fx = {
        // count a number up. fmt(value) -> string
        count(node, to, fmt, dur) {
            dur = dur || 1100;
            if (reduce) { node.textContent = fmt(to); return; }
            const o = { v: 0 }, a = A();
            if (a) { try { a.animate(o, { v: to, duration: dur, ease: 'outExpo', onUpdate: () => { node.textContent = fmt(o.v); }, onComplete: () => { node.textContent = fmt(to); } }); return; } catch (e) { /* fall through */ } }
            const t0 = performance.now();
            const tick = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); node.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(tick); else node.textContent = fmt(to); };
            requestAnimationFrame(tick);
        },
        // fade + rise, one after another
        reveal(nodes, delay) {
            nodes = Array.from(nodes); if (!nodes.length) return;
            if (reduce) { nodes.forEach(n => { n.style.opacity = 1; }); return; }
            const a = A();
            if (a && a.stagger) { try { a.animate(nodes, { opacity: [0, 1], y: [14, 0], duration: 650, delay: a.stagger(55, { start: delay || 0 }), ease: 'outCubic' }); return; } catch (e) { /* fall through */ } }
            nodes.forEach((n, i) => { n.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: (delay || 0) + i * 55, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }); });
        },
        // grow SVG bars from the left
        bars(rects) {
            rects = Array.from(rects); if (reduce) return;
            const a = A();
            if (a && a.stagger) { try { a.animate(rects, { scaleX: [0, 1], duration: 800, delay: a.stagger(45), ease: 'outQuart' }); return; } catch (e) { /* fall through */ } }
            rects.forEach((r, i) => r.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 800, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
        },
        // draw a ring gauge
        ring(circle, len, frac) {
            const to = len * (1 - frac);
            if (reduce) { circle.style.strokeDashoffset = to; return; }
            const a = A();
            if (a) { try { a.animate(circle, { strokeDashoffset: [len, to], duration: 1300, ease: 'outCubic' }); circle.style.strokeDashoffset = to; return; } catch (e) { /* fall through */ } }
            circle.animate([{ strokeDashoffset: len }, { strokeDashoffset: to }], { duration: 1300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }); circle.style.strokeDashoffset = to;
        },
        // a quick pulse down the pipeline nodes
        pulse(nodes, upTo) {
            if (reduce) return;
            const list = Array.from(nodes).slice(0, upTo), a = A();
            if (a && a.stagger) { try { a.animate(list, { scale: [1, 1.04, 1], duration: 420, delay: a.stagger(110), ease: 'inOutQuad' }); return; } catch (e) { /* fall through */ } }
            list.forEach((n, i) => n.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 420, delay: i * 110 }));
        }
    };
    // run `fn` the first time a block scrolls into view
    const once = (node, fn) => {
        if (!('IntersectionObserver' in window)) { fn(); return; }
        const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.15 });
        io.observe(node);
    };

    // ---------- chrome ----------
    $('stamp').textContent = 'measured ' + D.generated;
    $('back').addEventListener('click', () => {      // go back to the app in the SAME tab (the app keeps your sign-in)
        let same = false; try { same = document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* ignore */ }
        if (same && history.length > 1) history.back(); else location.href = '/';
    });
    const links = Array.from(document.querySelectorAll('#nav a'));
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }); }, { rootMargin: '-35% 0px -55% 0px' });
        document.querySelectorAll('main .sec').forEach(s => io.observe(s));
    }

    // ---------- overview ----------
    const B = D.browser, F = D.firstLook;
    const kpis = [
        { v: D.heldOut.crisis.recall * 100, f: (x) => Math.round(x) + '%', l: 'crisis messages caught on fresh wording', t: 'was ' + pct(F.crisis2.recall) + ' on first look', w: true },
        { v: D.coverage.languages, f: (x) => Math.round(x) + '', l: 'languages: chat, voice, safety, helplines', t: 'incl. Kannada, Hindi, Tamil, Telugu' },
        { v: D.speed.crisisMs, f: (x) => x.toFixed(3), u: 'ms', l: 'on-device safety check, per message', t: 'before any AI model' },
        B ? { v: B.crisisMs, f: (x) => Math.round(x) + '', u: 'ms', l: 'send → crisis screen (median)', t: 'p95 ' + Math.round(B.crisisP95) + ' ms' } : null,
        B ? { v: B.loadMs, f: (x) => Math.round(x) + '', u: 'ms', l: 'first visit: app ready (median)', t: 'repeat visit ' + Math.round(B.warmLoadMs) + ' ms · p95 ' + Math.round(B.loadP95) + ' ms' } : null,
        { v: D.weight.totalGzKB, f: (x) => Math.round(x) + '', u: 'KB', l: 'whole first load, compressed', t: 'app + icons + fonts, nothing from other servers' }
    ].filter(Boolean);
    kpis.forEach(k => {
        const c = h('div', 'kpi reveal'); const v = h('div', 'v'); v.textContent = k.f(0); if (k.u) v.append(h('small', '', k.u));
        const num = document.createTextNode(''); c.append(v, h('div', 'l', k.l), h('span', 't' + (k.w ? ' w' : ''), esc(k.t))); $('kpis').append(c);
        k._node = v; k._c = c;
    });
    once($('kpis'), () => { fx.reveal(kpis.map(k => k._c)); kpis.forEach(k => { const u = k._node.querySelector('small'); const tn = k._node.firstChild; const holder = { set textContent(s) { tn.nodeValue = s; } }; fx.count(holder, k.v, k.f, 1200); }); });

    const gauges = [
        ['Crisis recall', D.crisis.recall, 'set 1, after fixes'], ['Crisis precision', D.crisis.precision, 'set 1: few false alarms'],
        ['Fresh-set recall', D.heldOut.crisis.recall, 'after fixes (was ' + pct(F.crisis2.recall) + ')'], ['Language detection', D.lang.accuracy, '56 sentences, after fixes'], ['Fresh-set language', D.heldOut.lang.accuracy, '18 unseen sentences']
    ];
    const gEls = gauges.map(([name, v, cap]) => {
        const g = h('div', 'gauge reveal'); const len = 2 * Math.PI * 48;
        const svg = el('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': `${name}: ${pct(v, 1)}` });
        const col = v >= .95 ? 'var(--ok)' : v >= .8 ? 'var(--warn)' : 'var(--bad)';
        svg.append(el('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: 'var(--line)', 'stroke-width': 10 }));
        const arc = el('circle', { cx: 60, cy: 60, r: 48, fill: 'none', stroke: col, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': len, 'stroke-dashoffset': len, transform: 'rotate(-90 60 60)' });
        const num = el('text', { x: 60, y: 67, 'text-anchor': 'middle', class: 'num' }, '0%');
        svg.append(arc, num); g.append(svg, h('div', 'cap', `<b>${esc(name)}</b><br>${esc(cap)}`)); $('gauges').append(g);
        return { g, arc, num, len, v };
    });
    once($('gauges'), () => { fx.reveal(gEls.map(x => x.g)); gEls.forEach(x => { fx.ring(x.arc, x.len, x.v); fx.count({ set textContent(s) { x.num.textContent = s; } }, x.v * 100, (n) => Math.round(n) + '%', 1300); }); });

    // ---------- bar chart helper ----------
    function bars(target, rows, opts) {
        opts = opts || {};
        const rowH = 28, labelW = opts.labelW || 118, W = 520, plotW = W - labelW - 64, H = rows.length * rowH + 22;
        const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.aria || 'bar chart' }); const rects = [];
        [0, .25, .5, .75, 1].forEach(g => { const x = labelW + g * plotW; svg.append(el('line', { x1: x, x2: x, y1: 0, y2: H - 20, class: 'grid' }), el('text', { x, y: H - 5, 'text-anchor': 'middle' }, Math.round(g * 100) + '%')); });
        rows.forEach(([label, v, txt, color], i) => {
            const y = i * rowH + 4;
            svg.append(el('text', { x: labelW - 8, y: y + 14, 'text-anchor': 'end' }, label));
            const r = el('rect', { class: 'bar', x: labelW, y, width: Math.max(2, v * plotW), height: 18, rx: 4, fill: `var(${color || '--bar'})` }); rects.push(r); svg.append(r);
            svg.append(el('text', { x: labelW + v * plotW + 6, y: y + 14, class: 'val' }, txt));
        });
        target.append(svg); once(target, () => fx.bars(rects));
    }

    // ---------- safety accuracy ----------
    bars($('chart-recall'), [
        ['Set 1 · first look', F.crisis1.recall, pct(F.crisis1.recall, 1), '--bar2'], ['Set 1 · after fixes', D.crisis.recall, pct(D.crisis.recall), '--bar'],
        ['Fresh set · first look', F.crisis2.recall, pct(F.crisis2.recall), '--bar2'], ['Fresh set · after fixes', D.heldOut.crisis.recall, pct(D.heldOut.crisis.recall), '--bar']
    ], { labelW: 150, aria: 'Crisis messages caught, before and after fixes' });
    const heat = (target, map) => {
        const cells = Object.keys(NAMES).map(c => { const v = map[c]; const cell = h('div', 'cell reveal ' + (v >= .95 ? 'good' : v >= .8 ? 'mid' : 'low'), `${esc(NAMES[c])}<b>${v === undefined ? '–' : pct(v)}</b>`); cell.tabIndex = 0; cell.title = `${NAMES[c]}: ${v === undefined ? 'n/a' : pct(v, 1)}`; target.append(cell); return cell; });
        once(target, () => fx.reveal(cells));
    };
    heat($('heat-crisis'), Object.fromEntries(Object.entries(D.crisis.perLang).map(([k, v]) => [k, v.accuracy])));
    const hm = D.heldOut.crisis;
    $('held-note').innerHTML = `<b>Read this before trusting the 100%.</b> On a fresh set of ${hm.n} sentences written after the first round, the detector caught only <b>7 of 28</b> crisis messages (${pct(F.crisis2.recall)}) the first time. It found direct wording but missed indirect lines like “everyone would be better off without me”. We widened the patterns and the same set now scores ${pct(hm.recall)}. That proves the fix works for these sentences, <b>not</b> that every new wording is caught. Native speakers should review the crisis text before public release.`;

    // ---------- languages ----------
    bars($('chart-lang'), Object.keys(NAMES).map(c => [NAMES[c], D.lang.perLang[c] || 0, pct(D.lang.perLang[c] || 0), '--bar']), { aria: 'Language detection accuracy per language' });
    const hl = D.heldOut.lang, rows = [['All 18 fresh sentences', hl.accuracy, pct(hl.accuracy), '--bar']];
    hl.misses.forEach(m => rows.push([`missed: ${NAMES[m.lang]}`, 0, `got ${m.got ? NAMES[m.got] || m.got : 'unsure'}`, '--bar2']));
    bars($('chart-lang-held'), rows, { labelW: 150, aria: 'Language detection on fresh sentences' });

    // ---------- speed ----------
    const sp = [['Safety check on a message', D.speed.crisisMs], ['Language detection', D.speed.langMs]];
    if (B) sp.push(['Server health round trip', B.healthMs], ['Send → crisis screen', B.crisisMs], ['Send → reply (no AI)', B.replyMs], ['App ready, first visit', B.loadMs], ['App ready, repeat visit', B.warmLoadMs]);
    (function () {
        const rowH = 30, labelW = 190, W = 560, plotW = W - labelW - 90, lo = 0.001, hi = 1000, H = sp.length * rowH + 28, rects = [];
        const pos = (v) => (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
        const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Time per step on a log scale' });
        [0.001, 0.01, 0.1, 1, 10, 100, 1000].forEach(g => { const x = labelW + pos(g) * plotW; svg.append(el('line', { x1: x, x2: x, y1: 0, y2: H - 22, class: 'grid' }), el('text', { x, y: H - 6, 'text-anchor': 'middle' }, String(g))); });
        sp.forEach(([label, v], i) => {
            const y = i * rowH + 4; svg.append(el('text', { x: labelW - 8, y: y + 14, 'text-anchor': 'end' }, label));
            const r = el('rect', { class: 'bar', x: labelW, y, width: Math.max(2, pos(v) * plotW), height: 18, rx: 4, fill: 'var(--bar)' }); rects.push(r); svg.append(r);
            svg.append(el('text', { x: labelW + pos(v) * plotW + 6, y: y + 14, class: 'val' }, fmtMs(v)));
        });
        $('chart-speed').append(svg); once($('chart-speed'), () => fx.bars(rects));
    })();
    const w = D.weight, c = D.coverage;
    [[Math.round(w.totalGzKB) + ' KB', 'first load, compressed'], [Math.round(w.jsKB) + ' KB', `JS, ${w.jsFiles} files`], [c.languages + '', 'languages'], [c.games + '', 'calming games'], [c.supportStories + ' + ' + c.supportVideos, 'stories + videos'], [c.helplineRegions + '', 'helpline regions']]
        .forEach(([n, l]) => $('weight').append(h('div', '', `<b>${esc(n)}</b><span>${esc(l)}</span>`)));
    $('s-check').textContent = fmtMs(D.speed.crisisMs); $('s-crisis').textContent = B ? fmtMs(B.crisisMs) : 'a fraction of a second';

    // ---------- comparison ----------
    const ROWS = [
        ['Free to use', [1, .5, .5, 1], 'Mindsence has no paywall in this project'],
        ['Chat and safety in 14 languages incl. Kannada, Hindi, Tamil, Telugu', [1, .5, .5, .5], ''],
        ['Crisis check that never depends on an AI model', [1, .5, 0, 0], 'In Mindsence it runs before the model, on the device'],
        ['Helplines by language, tap to call', [1, .5, 0, .5], ''],
        ['Voice conversation with a spoken reply', [1, .5, .5, 0], ''],
        ['Hears the tone of your voice (voice emotion)', [.5, .5, 0, 0], 'Mindsence: optional, English-trained model'],
        ['Can run fully on your own device', [1, 0, .5, 0], 'WebLLM / local Ollama option'],
        ['Games, rooms and music for calming down, in the same app', [1, .5, 0, 0], ''],
        ['Real stories and videos at hard moments, with sources', [1, 0, 0, .5], 'Wikipedia-linked'],
        ['Tested against a published, open benchmark', [.5, 0, 0, 0], 'Small, self-written; see Method & limits']
    ];
    const COLS = ['Mindsence', 'Typical mental-health chat apps', 'General AI chatbots', 'Static self-help sites'];
    const tbl = $('matrix'), thead = h('thead'), trh = h('tr'); trh.append(h('th', '', 'CAPABILITY')); COLS.forEach((cn, i) => trh.append(h('th', i === 0 ? 'me' : '', esc(cn)))); thead.append(trh); tbl.append(thead);
    const tb = h('tbody');
    ROWS.forEach(([name, vals, note]) => {
        const tr = h('tr', 'reveal'); const first = h('td', '', esc(name)); if (note) first.append(h('small', '', esc(note))); tr.append(first);
        vals.forEach((v, i) => tr.append(h('td', i === 0 ? 'me' : '', `<i class="dot ${v === 1 ? 'full' : v === .5 ? 'half' : 'none'}" role="img" aria-label="${v === 1 ? 'yes' : v === .5 ? 'partly or depends' : 'usually not'}"></i>`)));
        tb.append(tr);
    });
    tbl.append(tb); once(tbl, () => fx.reveal(tb.children));

    // ---------- real detectors (analyzer + critical situations) ----------
    const ready = () => typeof detectCrisis === 'function' && typeof detectLang === 'function' && typeof CRISIS_PATTERNS !== 'undefined' && typeof detectDistress === 'function';
    function analyze(text) {
        const norm = normalizeForCrisis(text);
        const matched = CRISIS_PATTERNS.filter(re => re.test(norm));
        const crisis = matched.length > 0;
        const lang = detectLang(text);
        const reps = 300, t0 = performance.now(); for (let i = 0; i < reps; i++) detectCrisis(text); const per = (performance.now() - t0) / reps;
        const distress = !crisis && detectDistress(text);
        return { norm, matched, crisis, lang, distress, theme: distress ? supportTheme(text) : null, ms: per };
    }
    function renderAnalysis(text) {
        const out = $('an-result'), flow = $('an-flow'); out.textContent = '';
        flow.classList.remove('crisis', 'distress'); flow.querySelectorAll('.node').forEach(n => n.classList.remove('hot'));
        if (!text.trim()) { out.append(h('div', 'res ok', '<h4>WAITING</h4><div class="big">Type or pick an example</div><p>The result appears as you type.</p>')); $('an-route').textContent = 'Route'; return; }
        const r = analyze(text), lc = r.lang || 'en';
        const cls = r.crisis ? 'crisis' : r.distress ? 'distress' : 'ok';
        flow.classList.add(r.crisis ? 'crisis' : r.distress ? 'distress' : 'x');
        const nodes = flow.querySelectorAll('.node'); nodes.forEach(n => n.classList.add('hot'));
        $('an-route').innerHTML = r.crisis ? 'Crisis screen<small>AI not called</small>' : r.distress ? 'Support card<small>then AI</small>' : 'AI companion';
        fx.pulse(nodes, 4);
        const res1 = h('div', 'res ' + cls, `<h4>VERDICT</h4><div class="big">${r.crisis ? 'Crisis detected' : r.distress ? 'Distress noticed' : 'Normal message'}</div><p>${r.crisis ? `${r.matched.length} safety pattern${r.matched.length > 1 ? 's' : ''} matched.` : r.distress ? 'Not a crisis, but heavy: a gentle support card is offered.' : 'No safety pattern matched. It goes to the AI companion.'}</p>${r.crisis ? `<p>First match: <code>${esc(r.matched[0].source.slice(0, 90))}</code></p>` : ''}`);
        const res2 = h('div', 'res ok', `<h4>LANGUAGE &amp; SPEED</h4><div class="big">${r.lang ? esc(NAMES[r.lang]) : 'Not sure'}</div><p>Safety check took <b>${(r.ms * 1000).toFixed(1)} µs</b> (average of 300 runs) on this device.</p><p>Normalised: <code>${esc(r.norm.slice(0, 80))}</code></p>`);
        out.append(res1, res2);
        if (r.crisis) {
            const lines = helplinesFor(lc, true).slice(0, 4).map(x => `<li><a href="${esc(x.href)}">${esc(x.region)}: ${esc(x.name)} · ${esc(x.contact)}</a></li>`).join('');
            out.append(h('div', 'res crisis', `<h4>WHAT THE PERSON SEES</h4><div class="big">Caring message + helplines</div><p>In ${esc(NAMES[lc])}, instantly, from a fixed text (no AI):</p><ul>${lines}</ul>`));
        } else if (r.distress) {
            let story = null, vids = []; try { story = pickSupportStory(r.theme, lc); vids = pickSupportVideos(r.theme, 2, false); } catch (e) { /* ignore */ }
            out.append(h('div', 'res distress', `<h4>SUPPORT CARD</h4><div class="big">Theme: ${esc(r.theme)}</div>${story ? `<p>A true story${story.who && story.who !== 'You' ? ` about <b>${esc(story.who)}</b>` : ''}${vids.length ? ' and ' + vids.length + ' videos' : ''}, with sources.</p>` : ''}`));
        }
    }
    function buildCritical() {
        const S = [
            ['Direct statement', 'en', 'I want to die', 1], ['Direct statement', 'hi', 'मैं मरना चाहता हूँ', 1], ['Direct statement', 'kn', 'ನಾನು ಸಾಯಬೇಕು ಅನಿಸುತ್ತಿದೆ', 1], ['Direct statement', 'es', 'ya no quiero vivir más', 1],
            ['Indirect / hopeless', 'en', "everyone would be better off without me", 1], ['Indirect / hopeless', 'ta', 'நான் இல்லாமல் எல்லோரும் நன்றாக இருப்பார்கள்', 1], ['Indirect / hopeless', 'de', 'alle wären ohne mich besser dran', 1], ['Indirect / hopeless', 'ja', '私がいない方がみんな幸せだと思う', 1],
            ['Self-harm', 'en', 'I want to hurt myself tonight', 1], ['Self-harm', 'fr', 'je veux me faire du mal', 1], ['Self-harm', 'ar', 'أفكر في الانتحار', 1],
            ['Plan or method', 'en', "I've been planning how to end my life", 1], ['Plan or method', 'en', 'I have thought about taking all my pills', 1],
            ['Romanised Hindi', 'hi', 'mujhe marna chahta hu', 1], ['Slang', 'en', 'honestly just kms', 1],
            ['Idiom: must not alert', 'en', "I'm dying of laughter at this video", 0], ['Idiom: must not alert', 'de', 'diese Hitze bringt mich um, ich brauche Wasser', 0], ['Idiom: must not alert', 'es', 'este calor me está matando', 0],
            ['Everyday sadness', 'en', 'I feel sad and tired today', 0], ['Everyday sadness', 'kn', 'ನಾನು ಸ್ವಲ್ಪ ಬೇಜಾರಾಗಿದ್ದೇನೆ', 0], ['Everyday sadness', 'hi', 'मैं आज उदास हूँ', 0],
            ['Exam / work stress', 'en', 'this exam is killing me, I am so stressed', 0], ['Exam / work stress', 'pt', 'estou preocupado com a prova', 0], ['Exam / work stress', 'ja', '明日の試験が心配です', 0]
        ];
        const t = $('crit-table'); t.append(h('thead', '', '<tr><th>SITUATION</th><th>LANG</th><th>MESSAGE</th><th>MUST</th><th class="c">RESULT</th></tr>'));
        const tb = h('tbody'); let pass = 0; const trs = [];
        S.forEach(([cat, lang, text, must]) => {
            const got = detectCrisis(text) ? 1 : 0, okk = got === must; if (okk) pass++;
            const tr = h('tr', 'reveal', `<td>${esc(cat)}</td><td><span class="lang">${esc(lang)}</span></td><td class="q" dir="auto">${esc(text)}</td><td><span class="tag ${must ? 'must' : 'not'}">${must ? 'ALERT' : 'NO ALERT'}</span></td><td class="c ${okk ? 'ok' : 'bad'}">${okk ? '✓ pass' : '✗ ' + (must ? 'missed' : 'false alarm')}</td>`);
            tb.append(tr); trs.push(tr);
        });
        t.append(tb);
        const sc = $('crit-score'); sc.textContent = `${pass} / ${S.length} passed`; if (pass < S.length) sc.classList.add('warn');
        once(t, () => fx.reveal(trs));
    }

    function startReal() {
        if (!ready()) { $('an-result').append(h('div', 'res', '<h4>UNAVAILABLE</h4><p>The detector scripts did not load.</p>')); return; }
        const input = $('an-input'), EX = [
            ["I don't want to live anymore", 'en'], ['ನನಗೆ ಬದುಕಲು ಇಷ್ಟವಿಲ್ಲ', 'kn'], ['मुझे अब जीने का मन नहीं करता', 'hi'], ['this exam is killing me', 'en'], ['I feel hopeless and worthless lately', 'en'], ['मैं बहुत थका हुआ हूँ', 'hi'], ['hoy fue un buen día', 'es']
        ];
        EX.forEach(([txt]) => { const b = h('button', 'chip'); b.type = 'button'; b.textContent = txt; b.dir = 'auto'; b.onclick = () => { input.value = txt; renderAnalysis(txt); input.focus(); }; $('an-chips').append(b); });
        let timer; input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => renderAnalysis(input.value), 120); });
        renderAnalysis(''); buildCritical();
    }
    if (document.readyState === 'complete') startReal(); else window.addEventListener('load', startReal);
})();
