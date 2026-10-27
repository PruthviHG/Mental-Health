// ==========================================
// --- CHAT UI + SEND FLOW ---
// ==========================================
const chatbox = document.getElementById("chatbox");
const sendButton = document.getElementById("sendButton");
let receiving = false;
let requestSeq = 0;   // guards against an interrupted request resetting a newer one

// The scroll container is <main>, not the window (body is overflow:hidden).
function scrollChat(smooth = true) {
    const scroller = chatbox.parentElement;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

// The MIME popup (js/mime.js) registers its list here while it is open,
// so replies are mirrored into it without showing the full chat screen.
let mimeBox = null;
function setMimeBox(el) { mimeBox = el; }
function activeBoxes() { return mimeBox ? [chatbox, mimeBox] : [chatbox]; }
function scrollBoxes(smooth = true) {
    scrollChat(smooth);
    if (mimeBox) mimeBox.scrollTo({ top: mimeBox.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

// Typing anywhere focuses the input
document.addEventListener('keydown', (e) => {
    if (typeof authLocked === 'function' && authLocked()) return;
    if (isArcadeActive || isRoomsActive || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key.length === 1) messageInput.focus();
});

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    if (this.value !== '') this.style.height = this.scrollHeight + 'px';
});

function exportChat() {
    let content = "MINDSENCE CHAT LOG\n=================================\n\n";
    chatbox.querySelectorAll('.msg-enter').forEach(msg => {
        const isUser = msg.classList.contains('justify-end');
        const textElem = msg.querySelector(isUser ? 'div.bg-cyan-900\\/40' : '.ai-text');
        if (textElem) content += (isUser ? "USER:\n" : "MINDSENCE:\n") + textElem.textContent.trim() + "\n\n";
    });
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "Mindsence_Chat_Log.txt"; a.click();
    URL.revokeObjectURL(url);
}

window.copyText = function (btn) {
    const el = btn.closest('.ai-bubble')?.querySelector('.ai-text');
    if (!el || !navigator.clipboard) return;
    navigator.clipboard.writeText(el.textContent);
    const original = btn.innerText;
    btn.innerText = "COPIED!";
    setTimeout(() => btn.innerText = original, 2000);
};

function createMessageElement(text, role) {
    const wrapper = document.createElement("div");
    wrapper.className = `flex w-full msg-enter ${role === "user" ? "justify-end" : "justify-start"}`;
    const bubble = document.createElement("div");
    let contentContainer, actionRow;

    if (role === "user") {
        bubble.className = "max-w-[90%] md:max-w-[85%] bg-cyan-900/40 border border-cyan-500/30 text-cyan-50 px-4 py-2 md:px-5 md:py-3 rounded-lg rounded-br-sm shadow-[0_0_15px_rgba(69,243,255,0.1)] font-mono text-[13px] md:text-sm";
        bubble.textContent = text;
    } else {
        wrapper.className += " gap-2 md:gap-4";
        const avatar = document.createElement("div");
        avatar.className = "flex-none w-6 h-6 md:w-8 md:h-8 rounded bg-cyan-500/10 border border-cyan-400 flex items-center justify-center mt-1 text-cyan-400 font-bold font-mono text-[10px] md:text-xs shadow-[0_0_10px_rgba(69,243,255,0.2)]";
        avatar.textContent = "M";
        wrapper.appendChild(avatar);

        bubble.className = "ai-bubble max-w-[90%] md:max-w-[85%] bg-transparent border-l-2 border-cyan-500/50 pl-3 md:pl-4 py-1";
        contentContainer = document.createElement("div");
        contentContainer.className = "text-gray-300 ai-text";
        contentContainer.textContent = text;
        bubble.appendChild(contentContainer);

        actionRow = document.createElement("div");
        actionRow.className = "flex gap-4 mt-3 pt-2 border-t border-cyan-500/20 text-cyan-500/70 text-[10px] font-mono justify-end w-full opacity-0 transition-opacity duration-300 pointer-events-none";
        actionRow.innerHTML = `<button class="hover:text-cyan-300 transition-colors pointer-events-auto" onclick="copyText(this)">COPY</button>`;
        bubble.appendChild(actionRow);
    }
    wrapper.appendChild(bubble);
    return { wrapper, contentContainer, actionRow };
}

// Crisis path: never touches the LLM. Fixed, caring message + helplines.
function handleCrisis(userText, boxes) {
    const lang = (typeof convLang !== 'undefined') ? convLang : 'en';
    const crisisText = buildCrisisResponse(lang);
    stopAI();
    rememberUser(userText);
    crisisTurnsLeft = MINDSENCE.crisisModeTurns;

    boxes.forEach(box => {
        const { wrapper, actionRow } = createMessageElement(crisisText, "ai");
        wrapper.querySelector('.ai-bubble').classList.add('crisis-bubble');
        box.appendChild(wrapper);
        actionRow.classList.remove('opacity-0');
    });
    scrollBoxes();

    rememberAssistant(crisisText);
    playLocalVoice(crisisSpoken(lang));
    addSupportCard(boxes, lang, userText, true);      // real stories + videos, after the helplines
}

// A calm card with one real story and a few videos. Never replaces the helplines and never speaks.
function addSupportCard(boxes, lang, userText, crisis) {
    try {
        if (typeof supportAllowed !== 'function' || !supportAllowed(crisis)) return;
        const card = buildSupportCard(lang, userText, crisis);
        if (!card) return;
        boxes.forEach((box, i) => box.appendChild(i === 0 ? card : card.cloneNode(true)));
        scrollBoxes();
    } catch (e) { console.warn('support card skipped', e); }
}

async function streamReply(userText, boxes) {
    stopAI();                       // interruption trigger
    beginSpeechStream();            // voice starts after the first sentence, not after the whole reply
    const myId = ++requestSeq;
    receiving = true;
    sendButton.disabled = true;
    rememberUser(userText);

    llmAbortController = new AbortController();
    const signal = llmAbortController.signal;

    const els = boxes.map(box => {
        const el = createMessageElement("", "ai");
        box.appendChild(el.wrapper);
        el.contentContainer.innerHTML = '';
        const thinking = document.createElement('span');
        thinking.className = 'typing-dots text-cyan-500';
        thinking.setAttribute('role', 'status');
        thinking.setAttribute('aria-label', t('think'));
        thinking.title = t('think');
        for (let i = 0; i < 3; i++) thinking.appendChild(document.createElement('i'));
        el.contentContainer.appendChild(thinking);
        return el;
    });
    const setText = (t) => els.forEach(el => { el.contentContainer.textContent = t; });
    // Tokens can arrive far faster than the screen refreshes: draw at most once per frame, and scroll without animating.
    let pendingRaw = null, frameQueued = false;
    const nextFrame = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    const flush = () => { frameQueued = false; if (pendingRaw !== null) { setText(displayText(pendingRaw)); scrollBoxes(false); pendingRaw = null; } };

    let partial = "";
    try {
        const full = await requestChatReply({
            signal,
            onText: (raw) => { partial = raw; pendingRaw = raw; if (!frameQueued) { frameQueued = true; nextFrame(flush); } feedSpeech(raw); }
        });
        partial = full;
        pendingRaw = null;

        if (full.trim()) {
            rememberAssistant(full);
            setText(displayText(full) || "...");
            endSpeechStream(full);
        } else {
            setText(t('again'));
            endSpeechStream("");
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            rememberAssistant(partial);            // keep what was said before interruption
            if (!displayText(partial)) els.forEach(el => el.wrapper.remove());
        } else {
            console.error("Local chat error:", err);
            if (myId === requestSeq) { stopSpeech(); resumeListening(); }
            els.forEach(el => {
                const note = document.createElement("span");
                note.className = "text-red-400 text-xs font-mono mt-2 block";
                note.textContent = `[${friendlyLlmError(err)}]`;
                el.contentContainer.textContent = displayText(partial);
                el.contentContainer.appendChild(note);
            });
        }
    } finally {
        els.forEach(el => el.actionRow.classList.remove('opacity-0'));
        if (myId === requestSeq) {
            receiving = false;
            sendButton.disabled = false;
            if (!mimeBox) messageInput.focus();
        }
    }
}

function submitMessage() {
    const text = messageInput.value.trim();
    if (receiving || !text) return;
    if (typeof authLocked === 'function' && authLocked()) return;

    // Unlock audio playback inside the user gesture (browser autoplay policy)
    if (typeof unlockSpeechAudio === "function") unlockSpeechAudio();
    if (nexusVoicePlayer.src === "") nexusVoicePlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    messageInput.value = "";
    messageInput.style.height = 'auto';
    const boxes = activeBoxes();
    boxes.forEach(box => box.appendChild(createMessageElement(text, "user").wrapper));
    scrollBoxes();

    noteUserText(text);                                   // conversation language follows the person (auto mode)
    if (typeof supportNextTurn === 'function') supportNextTurn();
    if (detectCrisis(text)) { handleCrisis(text, boxes); return; }
    if (crisisTurnsLeft > 0) crisisTurnsLeft--;
    if (typeof companionIntercept === 'function' && companionIntercept(text, boxes)) return;     // songs / colour answers
    streamReply(text, boxes).then(() => {
        if (typeof detectDistress === 'function' && detectDistress(text) && !receiving) addSupportCard(boxes, convLang, text, false);
        if (typeof companionAfterReply === 'function' && !receiving) companionAfterReply(boxes, text);
    });
}

sendButton.addEventListener("click", submitMessage);
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); }
});

function showGreeting() {
    const text = (typeof companionGreetingText === 'function') ? companionGreetingText() : pick(t('greet'));
    chatbox.appendChild(createMessageElement(text, "ai").wrapper);
}

// Used on sign-out: wipes the conversation from the screen and from memory without asking.
function clearChatSilently() {
    stopAI();
    resetConversation();
    if (typeof companionReset === 'function') companionReset();
    chatbox.innerHTML = "";
    if (mimeBox) mimeBox.innerHTML = "";
    showGreeting();
}

function clearChat() {
    if (!confirm("Clear this conversation? Mindsence will forget it too.")) return;
    stopAI();
    resetConversation();
    if (typeof companionReset === 'function') companionReset();
    chatbox.innerHTML = "";
    if (mimeBox) mimeBox.innerHTML = "";
    showGreeting();
}

setTimeout(showGreeting, 800);
