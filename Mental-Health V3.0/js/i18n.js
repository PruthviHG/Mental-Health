// ==========================================
// --- LANGUAGE: selection, auto-detection, UI text ---
// uiLang   = language of the app chrome (header, greeting, placeholders): the picker, else the browser language.
// convLang = language of the conversation: forced by the picker, or in "auto" mode detected from what the
//            person writes. It drives the crisis message, the voice and the speech recognizer.
// The AI model itself simply answers in whatever language the person writes (see the server prompt).
// ==========================================
const LANGS = [
    { code: "en", native: "English",    speech: "en-US" },
    { code: "hi", native: "हिन्दी",      speech: "hi-IN" },
    { code: "kn", native: "ಕನ್ನಡ",       speech: "kn-IN" },
    { code: "ta", native: "தமிழ்",       speech: "ta-IN" },
    { code: "te", native: "తెలుగు",      speech: "te-IN" },
    { code: "bn", native: "বাংলা",       speech: "bn-IN" },
    { code: "mr", native: "मराठी",       speech: "mr-IN" },
    { code: "es", native: "Español",    speech: "es-ES" },
    { code: "fr", native: "Français",   speech: "fr-FR" },
    { code: "de", native: "Deutsch",    speech: "de-DE" },
    { code: "pt", native: "Português",  speech: "pt-BR" },
    { code: "ar", native: "العربية",     speech: "ar-SA", rtl: true },
    { code: "zh", native: "中文",         speech: "zh-CN" },
    { code: "ja", native: "日本語",       speech: "ja-JP" }
];

// Short function-word lists, only used to tell Latin-script languages apart.
const LATIN_HINTS = {
    es: ["hola", "estoy", "me", "mi", "que", "qué", "no", "es", "muy", "pero", "porque", "tengo", "siento", "gracias", "quiero", "como", "cómo", "una", "el", "la"],
    fr: ["je", "suis", "tu", "mon", "ma", "pas", "est", "très", "mais", "parce", "j'ai", "bonjour", "merci", "veux", "comment", "une", "le", "les", "ne", "n'"],
    de: ["ich", "bin", "nicht", "und", "ist", "ein", "eine", "mein", "meine", "aber", "weil", "habe", "fühle", "danke", "möchte", "wie", "das", "der", "die", "mir"],
    pt: ["olá", "oi", "estou", "não", "nao", "uma", "meu", "minha", "mas", "porque", "tenho", "sinto", "obrigado", "obrigada", "quero", "como", "você", "voce", "está", "muito"],
    en: ["i", "i'm", "im", "the", "and", "is", "my", "to", "feel", "have", "not", "you", "it", "that", "of", "a", "so", "me", "am", "just"]
};
const MARATHI_HINTS = ["आहे", "आहेस", "नाही", "मला", "काय", "वाटतं", "वाटत", "करतो", "करते", "तुला", "माझ"];

function _inRange(text, lo, hi) {
    for (const ch of text) { const c = ch.codePointAt(0); if (c >= lo && c <= hi) return true; }
    return false;
}

// Returns a language code, or null when the text is too short or ambiguous to say.
function detectLang(text) {
    const s = String(text || "").trim();
    if (!s) return null;
    if (_inRange(s, 0x3040, 0x30FF)) return "ja";                      // kana
    if (_inRange(s, 0x4E00, 0x9FFF)) return "zh";
    if (_inRange(s, 0x0C80, 0x0CFF)) return "kn";
    if (_inRange(s, 0x0B80, 0x0BFF)) return "ta";
    if (_inRange(s, 0x0C00, 0x0C7F)) return "te";
    if (_inRange(s, 0x0980, 0x09FF)) return "bn";
    if (_inRange(s, 0x0600, 0x06FF) || _inRange(s, 0x0750, 0x077F)) return "ar";
    if (_inRange(s, 0x0900, 0x097F)) return MARATHI_HINTS.some(w => s.includes(w)) ? "mr" : "hi";

    const words = s.toLowerCase().replace(/[’]/g, "'").split(/[^\p{L}']+/u).filter(Boolean);
    if (words.length === 0) return null;
    let best = null, bestScore = 0, enScore = 0;
    for (const [code, list] of Object.entries(LATIN_HINTS)) {
        const set = new Set(list);
        const score = words.filter(w => set.has(w)).length;
        if (code === "en") enScore = score;
        if (score > bestScore) { best = code; bestScore = score; }
    }
    if (!best || bestScore < 1) return null;
    if (best !== "en" && bestScore < 2 && words.length > 2) return null;   // one stray word is not enough
    if (best === "en") return enScore >= 1 ? "en" : null;
    return best;
}

function localeFor(code) { return LOCALES[code] || LOCALES.en; }
function langInfo(code) { return LANGS.find(l => l.code === code) || LANGS[0]; }
function speechLocale(code) { return langInfo(code).speech; }

function browserLang() {
    const prefs = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language])) || [];
    for (const p of prefs) {
        const base = String(p || "").toLowerCase().split("-")[0];
        if (LANGS.some(l => l.code === base)) return base;
    }
    return "en";
}

function _loadPref() {
    try { const v = localStorage.getItem("mindsence_lang"); if (v) return v; } catch (e) { /* storage unavailable */ }
    return MINDSENCE.language || "auto";
}

let langPref = _loadPref();                      // "auto" or a code
let uiLang = "en", convLang = "en";

function _resolveLangs() {
    uiLang = langPref !== "auto" && LANGS.some(l => l.code === langPref) ? langPref : browserLang();
    if (langPref !== "auto" && LANGS.some(l => l.code === langPref)) convLang = langPref;
    else if (!convLang || convLang === "en") convLang = uiLang;
}

// UI text in the app language / conversation language
function t(key) { const v = localeFor(uiLang)[key]; return v !== undefined ? v : LOCALES.en[key]; }
function tc(key) { const v = localeFor(convLang)[key]; return v !== undefined ? v : LOCALES.en[key]; }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

// Call with each message the person sends: in auto mode the conversation language follows them.
function noteUserText(text) {
    if (langPref !== "auto") { convLang = langPref; return convLang; }
    const d = detectLang(text);
    if (d) convLang = d;
    return convLang;
}

function applyLanguage() {
    if (typeof document === "undefined") return;
    const info = langInfo(uiLang);
    document.documentElement.lang = uiLang;
    document.documentElement.dir = info.rtl ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    if (typeof renderHelpModal === "function") renderHelpModal();
    if (typeof speechRecognition !== "undefined" && speechRecognition) speechRecognition.lang = speechLocale(convLang);
}

function setLanguagePref(pref) {
    langPref = pref;
    try { localStorage.setItem("mindsence_lang", pref); } catch (e) { /* storage unavailable */ }
    convLang = "en";                               // re-derive from the new preference
    _resolveLangs();
    applyLanguage();
}

function initLanguagePicker() {
    if (typeof document === "undefined") return;
    ["lang-select", "auth-lang"].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = "";
        const auto = document.createElement("option");
        auto.value = "auto"; auto.textContent = "🌐 Auto";
        sel.appendChild(auto);
        LANGS.forEach(l => { const o = document.createElement("option"); o.value = l.code; o.textContent = l.native; sel.appendChild(o); });
        sel.value = LANGS.some(l => l.code === langPref) ? langPref : "auto";
        sel.addEventListener("change", () => { setLanguagePref(sel.value); document.querySelectorAll("#lang-select, #auth-lang").forEach(o => { o.value = sel.value; }); });
    });
}

_resolveLangs();
if (typeof document !== "undefined") { initLanguagePicker(); applyLanguage(); }
