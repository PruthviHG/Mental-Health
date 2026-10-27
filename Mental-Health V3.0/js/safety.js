// ==========================================
// --- SAFETY: CRISIS DETECTION + HELPLINES (14 languages) ---
// Runs BEFORE any message reaches the LLM. A model must never be the only thing standing between a
// person in crisis and a bad answer. Matching is intentionally broad (a false alarm costs one caring
// message; a miss can cost far more). It is a safety net, not a diagnosis.
// Text is normalised first (case, accents, Hindi nukta, Arabic diacritics/alef forms) so spelling
// variants still match. Patterns for non-Latin scripts avoid \b, which does not work for them.
// ==========================================
const CRISIS_PATTERNS = [
    // ---- English ----
    /\bsuicid(e|al)\b/,
    /\b(kill|killing|hurt|hurting|harm|harming)\s+(myself|my\s?self)\b/,
    /\bcut(ting)?\s+myself\b(?!\s+(while|when|on|with|shaving|cooking|chopping|slicing|off))/,
    /\bend(ing)?\s+(my|this)\s+(own\s+)?(life|it\s+all)\b/,
    /\bend\s+it\s+all\b/,
    /\b(want|wanna|going|gonna)\s+(to\s+)?end\s+(it|everything)\b/,
    /\btake\s+my\s+(own\s+)?life\b/,
    /\b(want|wanna|going|plan(ning)?|thinking|ready|trying)\s+(to\s+)?(die|be\s+dead)\b/,
    /\b(don'?t|dont|do\s+not)\s+(want|wanna)\s+(to\s+)?(live|be\s+alive|exist|wake\s+up|be\s+here\s+any\s?more)\b/,
    /\b(no|not\s+any)\s+(reason|point)\s+(to|in)\s+(live|living|going\s+on|being\s+alive)\b/,
    /\bnothing\s+(left\s+)?to\s+live\s+for\b/,
    /\btired\s+of\s+(living|being\s+alive|life)\b/,
    /\bbetter\s+off\s+(dead|without\s+me)\b/,
    /\b(everyone|everybody|they|family)\s+(would|will)\s+be\s+better\s+off\s+without\s+me\b/,
    /\b(nobody|no\s*one)\s+(would|will)\s+(even\s+)?(miss|notice)\s+me\b/,
    /\bburden\s+(to|on)\s+(everyone|everybody|my\s+family|them|all\s+of\s+you|others)\b/,
    /\b(my\s+)?life\s+(is|feels)\s+(pointless|meaningless|worthless)\b/,
    /\bself[-\s]?harm/,
    /\bcan'?t\s+(go\s+on|take\s+(it|this)\s+anymore|do\s+this\s+anymore)\b/,
    /\bwish\s+i\s+(was|were)\s+(dead|never\s+born)\b/,
    /\bwish\s+i\s+(would|could)\s+(just\s+)?(die|disappear|not\s+wake\s+up)\b/,
    /\b(want|wanna)\s+to\s+(just\s+)?(disappear|vanish)\b(?!\s+into)/,
    /\bnever\s+wake\s+up\b/,
    /\b(overdose|overdosing)\b/,
    /\b(took|taken|swallowed|taking)\s+(a\s+)?(bunch|lot|handful|whole\s+bottle)\s+of\s+(pills|tablets|meds)\b/,
    /\bjump\s+(off|from)\s+(a\s+|the\s+)?(bridge|building|roof|balcony|cliff|terrace)\b/,
    /\b(hang|slit|drown)\s+(myself|my\s+wrists|my\s+throat)\b/,
    /\bkms\b/,
    /\bunaliv(e|ing)\s+my\s?self\b/,

    // ---- Hindi (Devanagari) + Marathi ----
    /मरना\s*चाह/, /मर\s*जाना\s*चाह/, /जीना\s*नहीं\s*चाह/, /जीने\s*का\s*मन\s*नहीं/, /जीने\s*की\s*(इच्छा|चाह)\s*नहीं/,
    /आत्महत्या/, /खुदकुशी/, /खुद\s*को\s*(मार|खत्म|नुकसान|चोट)/, /अपनी\s*जान\s*(दे|ले)/,
    /(जिंदगी|जिन्दगी)\s*खत्म/, /मर\s*जा(ऊं|ऊँ|ऊ)/, /सब\s*खत्म\s*कर/,
    /मरायचं|मरायचे|मरावंसं|मरावेसे/, /जगायचं\s*नाही|जगावंसं\s*वाटत\s*नाही|जगण्याची\s*इच्छा\s*नाही/, /स्वतःला\s*(संपव|इजा)/,
    // ---- Hinglish (Hindi in Latin letters) ----
    /\bmarna\s+chah(ta|ti|ata|ati)\b/, /\bmar\s+ja+na\s+chah(ta|ti|ata|ati)\b/, /\bmar\s+ja+(un|oon|ou)\b/,
    /\bjee?na\s+nahi\s+chah(ta|ti|ata|ati)\b/, /\bjee?ne\s+ka\s+man\s+nahi\b/, /\bjee?ne\s+ki\s+ichh?a\s+nahi\b/,
    /\bkhud\s?kushi\b/, /\baatmahatya\b/, /\bapni\s+jaan\s+(de|le)\b/, /\bkhud\s+ko\s+(khatam|maar|nuksan)\b/,
    /\bzindagi\s+khatam\b/, /\bsab\s+khatam\s+kar\b/,
    // ---- Kannada ----
    /ಸಾಯ(ಬೇಕ|ಲು|ೋಣ|ಿ\s*ಬಿಡ)/, /ಆತ್ಮಹತ್ಯೆ/, /ಬದುಕ(ಲು|ಬೇಕು)?\s*(ಇಷ್ಟ\s*ಇಲ್ಲ|ಇಷ್ಟವಿಲ್ಲ|ಅನಿಸುತ್ತಿಲ್ಲ)/, /ಜೀವನ\s*ಸಾಕು/, /ಸತ್ತು\s*ಹೋಗ/,
    // ---- Tamil ----
    /சாக\s*(வேண்டும்|வேணும்|விரும்ப|ணும்)/, /தற்கொலை/, /வாழ\s*(விரும்பவில்லை|பிடிக்கவில்லை|ஆசையில்லை)/, /உயிரை\s*மாய்த்/, /இறக்க\s*(வேண்டும்|விரும்ப)/,
    // ---- Telugu ----
    /చనిపోవాల/, /చచ్చిపోవాల/, /ఆత్మహత్య/, /(బతకాల|బ్రతకాల|జీవించాల)ని\s*లేదు/,
    // ---- Bengali ----
    /মরে\s*যেতে\s*চাই/, /মরতে\s*চাই/, /আত্মহত্যা/, /বাঁচতে\s*চাই\s*না|বাচতে\s*চাই\s*না/, /বেঁচে\s*থাকতে\s*(চাই\s*না|ইচ্ছা\s*করে\s*না)/, /নিজেকে\s*(শেষ|আঘাত)/,
    // ---- Spanish ----
    /\bquiero\s+(morir|morirme|matarme|desaparecer)\b/, /\bsuicid/, /\bno\s+quiero\s+(vivir|seguir\s+viviendo|despertar|estar\s+vivo|estar\s+viva)\b/,
    /\b(acabar|terminar)\s+con\s+(mi\s+vida|todo)\b/, /\bquitarme\s+la\s+vida\b/, /\bmejor\s+sin\s+mi\b/, /\bhacerme\s+dano\b/, /\bautolesion/, /\bya\s+no\s+puedo\s+mas\b/,
    // ---- French ----
    /\bje\s+veux\s+mourir\b/, /\bme\s+tuer\b/, /\bsuicid/, /\b(plus\s+envie\s+de\s+vivre|ne\s+veux\s+plus\s+vivre|veux\s+plus\s+vivre)\b/,
    /\ben\s+finir\s+(avec\s+(la\s+vie|tout)|maintenant)\b/, /\bmettre\s+fin\s+a\s+(mes\s+jours|ma\s+vie)\b/, /\bsans\s+moi\b.*\b(mieux)\b|\bmieux\s+sans\s+moi\b/,
    /\bme\s+faire\s+du\s+mal\b/, /\bautomutilation/, /\bje\s+n'en\s+peux\s+plus\b/,
    // ---- German ----
    /\bich\s+will\s+(sterben|nicht\s+mehr\s+leben)\b/, /\bmochte\s+(sterben|nicht\s+mehr\s+leben)\b/, /\bbring\w*\s+mich\s+um\b|\bmich\s+umbringen\b/,
    /\bsuizid/, /\bselbstmord/, /\bleben\s+beenden\b/, /\bbesser\s+ohne\s+mich\b/, /\bmir\s+(etwas\s+)?antun\b/, /\bmich\s+(selbst\s+)?verletzen\b/, /\britzen\b/, /\bkann\s+nicht\s+mehr\b/,
    // ---- Portuguese ----
    /\bquero\s+morrer\b/, /\bme\s+matar\b/, /\bsuicid/, /\bnao\s+quero\s+(mais\s+)?viver\b/, /\bacabar\s+com\s+(a\s+minha|minha)\s+vida\b/,
    /\btirar\s+(a\s+minha|minha)\s+vida\b/, /\bmelhor\s+sem\s+mim\b/, /\bme\s+machucar\b/, /\bautomutilacao\b/, /\bnao\s+aguento\s+mais\b/,
    // ---- Arabic (after normalisation) ----
    /اريد\s*(ان\s*)?(اموت|الموت)/, /انتحار|انتحر/, /اقتل\s*نفسي/, /لا\s*اريد\s*(ان\s*)?اعيش/, /تعبت\s*من\s*الحياة/, /(ايذاء|اؤذي)\s*نفسي/, /انهاء\s*حياتي/,
    // ---- Chinese ----
    /想死|自杀|自殺|不想活|活不下去|结束(自己的)?生命|結束(自己的)?生命|伤害自己|傷害自己|轻生|輕生|了结自己|了結自己|想消失/,
    // ---- Japanese ----
    /死にたい|自殺|消えたい|生きたくない|生きていたくない|死んでしまいたい|自傷|リスカ|命を絶/
];

function normalizeForCrisis(text) {
    return String(text)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[‘’ʼ]/g, "'")
        .normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC")   // accents: "mí" -> "mi", "ñ" -> "n"
        .replace(/़/g, "")                                              // Hindi nukta: ज़ -> ज
        .replace(/[أإآٱ]/g, "ا")                    // Arabic alef variants -> ا
        .replace(/[ً-ٰٟـ]/g, "")                         // Arabic diacritics + tatweel
        .replace(/[​-‍﻿]/g, "");                              // zero-width characters
}

function detectCrisis(text) {
    if (!text) return false;
    const normalized = normalizeForCrisis(text);
    return CRISIS_PATTERNS.some(re => re.test(normalized));
}

// Verify numbers periodically; they can change. `langs` = languages for which the line is listed first;
// `core` lines are shown to everyone; `short` is the compact form used inside the crisis message.
const HELPLINES = [
    { region: "India", name: "Tele-MANAS (24x7, free)", contact: "14416", short: "Tele-MANAS 14416", href: "tel:14416", langs: ["hi", "kn", "ta", "te", "bn", "mr"], core: true },
    { region: "USA & Canada", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", short: "call or text 988", href: "tel:988", langs: ["es"], core: true },
    { region: "UK & Ireland", name: "Samaritans", contact: "116 123", short: "Samaritans 116 123", href: "tel:116123", langs: ["en"] },
    { region: "España", name: "Línea 024", contact: "024", short: "024", href: "tel:024", langs: ["es"] },
    { region: "France", name: "3114 (prévention du suicide)", contact: "3114", short: "3114", href: "tel:3114", langs: ["fr"] },
    { region: "Deutschland", name: "Telefonseelsorge", contact: "0800 111 0 111", short: "Telefonseelsorge 0800 111 0 111", href: "tel:08001110111", langs: ["de"] },
    { region: "Brasil", name: "CVV", contact: "188", short: "CVV 188", href: "tel:188", langs: ["pt"] },
    { region: "日本", name: "よりそいホットライン", contact: "0120-279-338", short: "0120-279-338", href: "tel:0120279338", langs: ["ja"] },
    { region: "Anywhere", name: "Find a helpline", contact: "findahelpline.com", short: "findahelpline.com", href: "https://findahelpline.com", langs: [], core: true }
];

// Helplines in the order shown to the person: ones for their language first.
function helplinesFor(lang, compact) {
    let base;
    if (lang === "en") {
        base = HELPLINES.filter(h => h.core || h.langs.includes("en"));          // India, USA, UK, Anywhere
    } else {
        const own = HELPLINES.filter(h => h.langs.includes(lang));
        const mine = [...own.filter(h => !h.core), ...own.filter(h => h.core)];   // local line first
        base = [...mine, ...HELPLINES.filter(h => h.core && !mine.includes(h))];
    }
    return compact ? base.slice(0, 5) : [...base, ...HELPLINES.filter(h => !base.includes(h))];
}

function _safetyLocale(lang) {
    const L = (typeof LOCALES !== "undefined") ? LOCALES : require("./locales.js").LOCALES;
    return L[lang] || L.en;
}
function _ensureAllLocales() {
    if (typeof LOCALES === "undefined" && typeof require !== "undefined") require("./locales2.js");
}

function buildCrisisResponse(lang) {
    _ensureAllLocales();
    const loc = _safetyLocale(lang);
    const lines = helplinesFor(lang, true).map(h => `• ${h.region}: ${h.short}`).join("\n");
    return `${loc.cIntro}\n${lines}\n\n${loc.cOutro}`;
}
function crisisSpoken(lang) { _ensureAllLocales(); return _safetyLocale(lang).cSpoken; }

const CRISIS_RESPONSE = buildCrisisResponse("en");
const CRISIS_SPOKEN = crisisSpoken("en");

// ----- Help modal (always reachable from the header; numbers are tap-to-call) -----
function renderHelpModal() {
    const list = document.getElementById('help-list');
    if (!list) return;
    const lang = typeof convLang !== "undefined" ? convLang : "en";
    list.innerHTML = '';
    helplinesFor(lang, false).forEach(h => {
        const li = document.createElement('li');
        li.className = 'help-item';
        const region = document.createElement('span'); region.className = 'help-region'; region.textContent = h.region;
        const name = document.createElement('span'); name.className = 'help-name'; name.textContent = h.name;
        const contact = document.createElement('a'); contact.className = 'help-contact'; contact.textContent = h.contact; contact.href = h.href;
        if (h.href.startsWith('https')) { contact.target = '_blank'; contact.rel = 'noopener noreferrer'; }
        li.append(region, name, contact);
        list.appendChild(li);
    });
}

function openHelpModal() {
    renderHelpModal();
    const modal = document.getElementById('help-modal');
    if (modal) { modal.classList.remove('hidden'); modal.querySelector('button')?.focus(); }
}
function closeHelpModal() {
    document.getElementById('help-modal')?.classList.add('hidden');
}

if (typeof document !== 'undefined') {
    renderHelpModal();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHelpModal(); });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { detectCrisis, normalizeForCrisis, HELPLINES, helplinesFor, buildCrisisResponse, crisisSpoken, CRISIS_RESPONSE, CRISIS_SPOKEN };
}
