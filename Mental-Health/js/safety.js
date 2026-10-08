// ==========================================
// --- SAFETY: CRISIS DETECTION + HELPLINES ---
// Runs BEFORE any message reaches the LLM. A small local model must never be
// the only thing standing between a person in crisis and a joke.
// Keyword matching is intentionally broad (a false alarm only costs a caring
// message; a miss can cost far more). It is a safety net, not a diagnosis.
// ==========================================
const CRISIS_PATTERNS = [
    /\bsuicid(e|al)\b/,
    /\b(kill|killing|hurt|hurting|harm|harming)\s+(myself|my\s?self)\b/,
    /\bcut(ting)?\s+myself\b(?!\s+(while|when|on|with|shaving|cooking|chopping|slicing|off))/,
    /\bend(ing)?\s+(my|this)\s+(own\s+)?(life|it\s+all)\b/,
    /\btake\s+my\s+(own\s+)?life\b/,
    /\b(want|wanna|going|plan(ning)?|thinking|ready|trying)\s+(to\s+)?(die|be\s+dead)\b/,
    /\bdon'?t\s+want\s+to\s+(live|be\s+alive|exist|wake\s+up)\b/,
    /\b(no|not\s+any)\s+(reason|point)\s+(to|in)\s+(live|living|going\s+on|being\s+alive)\b/,
    /\bbetter\s+off\s+(dead|without\s+me)\b/,
    /\bself[-\s]?harm/,
    /\bcan'?t\s+(go\s+on|take\s+(it|this)\s+anymore|do\s+this\s+anymore)\b/,
    /\bwish\s+i\s+(was|were)\s+(dead|never\s+born)\b/,
    /\bwish\s+i\s+(would|could)\s+(just\s+)?(die|disappear|not\s+wake\s+up)\b/,
    /\b(overdose|overdosing)\b/
];

function detectCrisis(text) {
    if (!text) return false;
    const normalized = String(text).toLowerCase().replace(/[\u2018\u2019]/g, "'");
    return CRISIS_PATTERNS.some(re => re.test(normalized));
}

// Verify numbers periodically; they can change.
const HELPLINES = [
    { region: "India", name: "Tele-MANAS (24x7, free)", contact: "14416" },
    { region: "USA", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988" },
    { region: "UK & Ireland", name: "Samaritans", contact: "116 123" },
    { region: "Anywhere", name: "Find a helpline", contact: "findahelpline.com" }
];

const CRISIS_RESPONSE =
`I'm really glad you told me, and I'm taking it seriously. 🤍 You don't have to carry this alone, and you deserve support from a real person right now.

If you might act on these thoughts, or you're in danger, please call your local emergency number (112 in India, 911 in the US) or reach a crisis line:
• India: Tele-MANAS 14416
• USA: call or text 988
• UK & Ireland: Samaritans 116 123
• Anywhere: findahelpline.com

If you can, tell someone near you too: a friend, a family member, someone you trust. I'm staying right here with you in this chat. Do you want to tell me what's happening?`;

const CRISIS_SPOKEN =
    "I'm really glad you told me. You don't have to carry this alone. Please reach out to a crisis line or someone you trust right now. The numbers are on your screen. I'm right here with you.";

// ----- Help modal (always reachable from the header) -----
function renderHelpModal() {
    const list = document.getElementById('help-list');
    if (!list) return;
    list.innerHTML = '';
    HELPLINES.forEach(h => {
        const li = document.createElement('li');
        li.className = 'help-item';
        const region = document.createElement('span'); region.className = 'help-region'; region.textContent = h.region;
        const name = document.createElement('span'); name.className = 'help-name'; name.textContent = h.name;
        const contact = document.createElement('span'); contact.className = 'help-contact'; contact.textContent = h.contact;
        li.append(region, name, contact);
        list.appendChild(li);
    });
}

function openHelpModal() {
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
    module.exports = { detectCrisis, HELPLINES, CRISIS_RESPONSE, CRISIS_SPOKEN };
}
