// ==========================================
// --- MIME: small chat popup inside Rooms ---
// Chat with Mindsence over the video room without leaving it.
// Shares the same conversation, voice and crisis handling as the main chat.
// ==========================================
(function initMime() {
    const roomsView = document.getElementById('rooms-video-view');
    if (!roomsView) return;

    const mimeBtn = document.createElement('button');
    const idleLabel = '<i class="fas fa-comment-dots mr-2"></i>MIME';
    mimeBtn.innerHTML = idleLabel;
    mimeBtn.className = 'absolute top-6 right-24 bg-black/60 border border-cyan-500/50 text-cyan-400 font-mono text-xs px-3 py-1.5 rounded hover:bg-cyan-500/20 transition-all z-[60] shadow-[0_0_10px_rgba(69,243,255,0.2)]';
    roomsView.appendChild(mimeBtn);

    const panel = document.createElement('div');
    panel.className = 'mime-popup';
    panel.innerHTML = `
        <div class="mime-head"><span>MIME CHAT</span><button class="mime-x" aria-label="Close MIME chat"><i class="fas fa-times"></i></button></div>
        <div class="mime-list" role="log" aria-live="polite"></div>
        <div class="mime-input-row">
            <button class="mime-btn mime-mic" aria-label="Toggle voice chat"><i class="fas fa-microphone"></i></button>
            <input class="mime-input" type="text" placeholder="Message your friend... 🤍" aria-label="Message">
            <button class="mime-btn mime-send" aria-label="Send message"><i class="fas fa-paper-plane"></i></button>
        </div>`;
    panel.style.display = 'none';
    roomsView.appendChild(panel);

    const list = panel.querySelector('.mime-list');
    const input = panel.querySelector('.mime-input');
    const micBtn = panel.querySelector('.mime-mic');
    let open = false;

    function openMime() {
        open = true;
        list.innerHTML = '';
        // Show the latest bit of the conversation so the popup has context.
        [...chatbox.querySelectorAll('.msg-enter')].slice(-6).forEach(n => list.appendChild(n.cloneNode(true)));
        list.scrollTop = list.scrollHeight;
        panel.style.display = 'flex';
        setMimeBox(list);
        mimeBtn.innerHTML = '<i class="fas fa-times mr-2"></i>EXIT MIME';
        mimeBtn.classList.replace('text-cyan-400', 'text-red-400');
        mimeBtn.classList.replace('border-cyan-500/50', 'border-red-400/50');
        input.focus();
    }

    function closeMime() {
        if (!open) return;
        open = false;
        panel.style.display = 'none';
        setMimeBox(null);
        mimeBtn.innerHTML = idleLabel;
        mimeBtn.classList.replace('text-red-400', 'text-cyan-400');
        mimeBtn.classList.replace('border-red-400/50', 'border-cyan-500/50');
    }

    function sendFromMime() {
        const text = input.value.trim();
        if (!text || receiving) return;
        input.value = '';
        messageInput.value = text;      // same pipeline as the main chat (history, safety, voice reply)
        sendButton.click();
    }

    mimeBtn.addEventListener('click', () => (open ? closeMime() : openMime()));
    panel.querySelector('.mime-x').addEventListener('click', closeMime);
    panel.querySelector('.mime-send').addEventListener('click', sendFromMime);
    input.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromMime(); }
    });

    // Voice: reuse the main mic (transcript -> same send flow), mirror its live state.
    if (liveVoiceBtn.style.display === 'none') micBtn.style.display = 'none';
    micBtn.addEventListener('click', () => liveVoiceBtn.click());
    new MutationObserver(() => micBtn.classList.toggle('live-active', liveVoiceBtn.classList.contains('live-active')))
        .observe(liveVoiceBtn, { attributes: true, attributeFilter: ['class'] });

    // Leaving the room closes the popup.
    document.getElementById('rooms-back-btn')?.addEventListener('click', closeMime);
    if (typeof closeRooms === 'function') {
        const originalCloseRooms = closeRooms;
        window.closeRooms = function () { closeMime(); return originalCloseRooms.apply(this, arguments); };
    }
})();
