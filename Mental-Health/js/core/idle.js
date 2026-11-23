// ==========================================
// --- HUMAN-LIKE IDLE CHECK-IN ---
// ==========================================
let idleCheckTimer;

function sendIdleMessage() {
    if ((typeof authLocked === 'function' && authLocked()) || receiving || isArcadeActive || isRoomsActive || inCrisisMode()) {
        resetIdleCheckTimer();
        return; 
    }
    
    const randomMessage = pick(tc('idle'));   // gentle, no-pressure check-ins in the conversation language
    
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

