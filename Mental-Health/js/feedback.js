// ==========================================
// --- FEEDBACK WIDGET & UI INJECTIONS ---
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. CREATE FEEDBACK WIDGET
    const fBtn = document.createElement('div');
    fBtn.innerHTML = '<i class="fas fa-envelope text-[14px]"></i>';
    fBtn.className = 'fixed bottom-4 right-4 w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center text-cyan-400 cursor-pointer hover:bg-cyan-500/30 hover:border-cyan-500 transition-all z-50 shadow-[0_0_10px_rgba(69,243,255,0.1)]';
    
    const fModal = document.createElement('div');
    fModal.className = 'fixed bottom-16 right-4 w-72 bg-gray-900/95 border border-cyan-500/30 rounded-xl p-4 hidden z-50 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-sm transition-opacity duration-300';
    fModal.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-cyan-400 font-mono text-xs font-bold">/// FEEDBACK</h3>
            <button id="fb-close" class="text-gray-500 hover:text-red-400 transition-colors"><i class="fas fa-times"></i></button>
        </div>
        <input type="email" id="fb-email" placeholder="your mail id..." class="w-full bg-black/50 border border-cyan-500/20 rounded p-2 text-xs text-gray-200 font-mono mb-2 outline-none focus:border-cyan-500/50">
        <textarea id="fb-text" placeholder="what's on your mind?..." class="w-full bg-black/50 border border-cyan-500/20 rounded p-2 text-xs text-gray-200 font-mono h-20 mb-3 outline-none focus:border-cyan-500/50 resize-none"></textarea>
        <button id="fb-submit" class="w-full bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 font-mono text-xs py-2 rounded transition-colors tracking-widest">SEND</button>
        <div id="fb-status" class="text-[10px] text-center mt-2 font-mono text-cyan-400 hidden">Sent securely 🤍</div>
    `;

    document.body.appendChild(fBtn);
    document.body.appendChild(fModal);

    fBtn.onclick = () => {
        fModal.classList.toggle('hidden');
        if (!fModal.classList.contains('hidden')) document.getElementById('fb-text').focus();
    };
    
    document.getElementById('fb-close').onclick = () => fModal.classList.add('hidden');

    document.getElementById('fb-submit').onclick = () => {
        const email = document.getElementById('fb-email').value;
        const text = document.getElementById('fb-text').value;
        if(email && text) {
            fetch(`${LOCAL_BACKEND_URL}/feedback`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, text})
            }).catch(() => console.log('Backend offline, feedback dropped.'));
            
            document.getElementById('fb-submit').style.display = 'none';
            document.getElementById('fb-status').style.display = 'block';
            setTimeout(() => {
                fModal.classList.add('hidden');
                document.getElementById('fb-submit').style.display = 'block';
                document.getElementById('fb-status').style.display = 'none';
                document.getElementById('fb-text').value = '';
            }, 2000);
        }
    };
});
