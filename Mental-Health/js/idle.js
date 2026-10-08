// ==========================================
// --- HUMAN-LIKE IDLE CHECK-IN ---
// ==========================================
let idleCheckTimer;

const idleCheckMessages = [
    "Hey... are you still there? [hmm] 🤍",
    "Did you have food yet?",
    "[sigh] Are you angry with me? 🥺",
    "Am I being boring? [laugh] You can tell me.",
    "Did you fall asleep on me? 🌙",
    "[hmm] What are you doing right now?",
    "Just checking in... everything okay?",
    "I'm still here if you need me.",
    "It's been a little quiet... you good? 🌿"
];

function sendIdleMessage() {
    if (receiving || isArcadeActive || isRoomsActive || inCrisisMode()) {
        resetIdleCheckTimer();
        return; 
    }
    
    const randomMessage = idleCheckMessages[Math.floor(Math.random() * idleCheckMessages.length)];
    
    // STRIP BRACKETS FOR IDLE MESSAGES UI
    const cleanDisplay = randomMessage.replace(/\[.*?\]|\*.*?\*/g, '').trim(); 
    const { wrapper } = createMessageElement(cleanDisplay, "ai");
    document.getElementById("chatbox").appendChild(wrapper);
    
    rememberAssistant(cleanDisplay);
    if (typeof playLocalVoice === 'function') {
        playLocalVoice(randomMessage);
    }
    
    scrollChat();
    resetIdleCheckTimer(); 
}

function resetIdleCheckTimer() {
    clearTimeout(idleCheckTimer);
    idleCheckTimer = setTimeout(sendIdleMessage, 300000); 
}

document.getElementById("messageInput").addEventListener("input", resetIdleCheckTimer);
document.getElementById("sendButton").addEventListener("click", resetIdleCheckTimer);

resetIdleCheckTimer();

