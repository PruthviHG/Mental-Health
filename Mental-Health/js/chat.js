// ==========================================
// --- CHAT UI + SEND FLOW ---
// ==========================================
const chatbox = document.getElementById("chatbox");
const sendButton = document.getElementById("sendButton");
let receiving = false;
let requestSeq = 0;   // guards against an interrupted request resetting a newer one

// The scroll container is <main>, not the window (body is overflow:hidden).
function scrollChat() {
    const scroller = chatbox.parentElement;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
}

// The MIME popup (js/mime.js) registers its list here while it is open,
// so replies are mirrored into it without showing the full chat screen.
let mimeBox = null;
function setMimeBox(el) { mimeBox = el; }
function activeBoxes() { return mimeBox ? [chatbox, mimeBox] : [chatbox]; }
function scrollBoxes() {
    scrollChat();
    if (mimeBox) mimeBox.scrollTo({ top: mimeBox.scrollHeight, behavior: "smooth" });
}

// Typing anywhere focuses the input
document.addEventListener('keydown', (e) => {
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
    stopAI();
    rememberUser(userText);
    crisisTurnsLeft = MINDSENCE.crisisModeTurns;

    boxes.forEach(box => {
        const { wrapper, actionRow } = createMessageElement(CRISIS_RESPONSE, "ai");
        wrapper.querySelector('.ai-bubble').classList.add('crisis-bubble');
        box.appendChild(wrapper);
        actionRow.classList.remove('opacity-0');
    });
    scrollBoxes();

    rememberAssistant(CRISIS_RESPONSE);
    playLocalVoice(CRISIS_SPOKEN);
}

async function streamReply(userText, boxes) {
    stopAI();                       // interruption trigger
    const myId = ++requestSeq;
    receiving = true;
    sendButton.disabled = true;
    rememberUser(userText);

    llmAbortController = new AbortController();
    const signal = llmAbortController.signal;

    const els = boxes.map(box => {
        const el = createMessageElement("", "ai");
        box.appendChild(el.wrapper);
        el.contentContainer.innerHTML = '<span class="animate-pulse text-cyan-500">Thinking...</span>';
        return el;
    });
    const setText = (t) => els.forEach(el => { el.contentContainer.textContent = t; });

    let partial = "";
    const speaker = createSpeechStreamer();   // speaks sentence by sentence while text streams
    try {
        const full = await requestChatReply({
            signal,
            onText: (raw) => { partial = raw; setText(displayText(raw)); scrollBoxes(); speaker.feed(raw); }
        });
        partial = full;

        if (full.trim()) {
            rememberAssistant(full);
            setText(displayText(full) || "...");
            speaker.finish(full);
        } else {
            setText("I'm here. Could you say that again? 🤍");
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            rememberAssistant(partial);            // keep what was said before interruption
            if (!displayText(partial)) els.forEach(el => el.wrapper.remove());
        } else {
            console.error("Local chat error:", err);
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

    // Unlock audio playback inside the user gesture (browser autoplay policy)
    if (nexusVoicePlayer.src === "") nexusVoicePlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

    messageInput.value = "";
    messageInput.style.height = 'auto';
    const boxes = activeBoxes();
    boxes.forEach(box => box.appendChild(createMessageElement(text, "user").wrapper));
    scrollBoxes();

    if (detectCrisis(text)) { handleCrisis(text, boxes); return; }
    if (crisisTurnsLeft > 0) crisisTurnsLeft--;
    streamReply(text, boxes);
}

sendButton.addEventListener("click", submitMessage);
messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(); }
});

const GREETINGS = [
    "Hey... I'm so glad you're here. 🤍 Take a deep breath. You are safe now, and you are not alone. How are you really feeling today?",
    "Hey there. Just wanted to remind you that I'm right here with you. What's on your mind? 🌿",
    "Hi. 🤍 Take a slow, deep breath. I'm here to listen to whatever you want to talk about.",
    "Hey... checking in. You don't have to go through anything alone. How's your heart today? ✨",
    "Hey, I've got you. 🫂 Take all the time you need, but I'm here when you're ready. How are you?"
];

function showGreeting() {
    const text = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    chatbox.appendChild(createMessageElement(text, "ai").wrapper);
}

function clearChat() {
    if (!confirm("Clear this conversation? Mindsence will forget it too.")) return;
    stopAI();
    resetConversation();
    chatbox.innerHTML = "";
    if (mimeBox) mimeBox.innerHTML = "";
    showGreeting();
}

setTimeout(showGreeting, 800);
