// ==========================================
// --- PHOTOS IN CHAT: attach, paste or drop a picture; it is shrunk in the browser and sent with the next message ---
// Only the last message carries the picture; it is not stored. Whether the model can actually see it depends on the model the
// server uses (Claude, GPT-4o and later, Gemini, LLaVA and similar can; others cannot, and then Mindsence says so honestly).
// ==========================================
const ATTACH_MAX_SIDE = 1024, ATTACH_TYPES = /^image\/(png|jpe?g|webp|gif)$/i;
let pendingImage = null;           // data: URL waiting to be sent
let outgoingImage = null;          // data: URL being sent with the message that is streaming now

function takePendingImage() { const i = pendingImage; setPendingImage(null); return i; }
function takeOutgoingImage() { const i = outgoingImage; outgoingImage = null; return i; }

function _shrinkImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
            try {
                const k = Math.min(1, ATTACH_MAX_SIDE / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
                const c = document.createElement("canvas"); c.width = w; c.height = h;
                const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL("image/jpeg", 0.82));
            } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable image")); };
        img.src = url;
    });
}

let _attachChip = null;
function setPendingImage(dataUrl) {
    pendingImage = dataUrl;
    if (_attachChip) { _attachChip.remove(); _attachChip = null; }
    if (!dataUrl) return;
    const input = document.getElementById("messageInput"), row = input && input.parentElement;
    if (!row) return;
    _attachChip = document.createElement("div");
    _attachChip.style.cssText = "position:absolute;bottom:calc(100% + 8px);left:8px;display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:10px;background:rgba(11,12,16,.95);border:1px solid rgba(134,207,201,.35);";
    const th = document.createElement("img"); th.src = dataUrl; th.alt = "Attached photo"; th.style.cssText = "width:44px;height:44px;object-fit:cover;border-radius:6px;";
    const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove photo"); x.style.cssText = "color:#9ca3af;font-size:18px;line-height:1;padding:0 4px;"; x.onclick = () => setPendingImage(null);
    _attachChip.append(th, x); row.style.position = row.style.position || "relative"; row.appendChild(_attachChip);
}

async function attachFile(file) {
    if (!file || !ATTACH_TYPES.test(file.type) || file.size > 25 * 1024 * 1024) return false;
    try { setPendingImage(await _shrinkImage(file)); const i = document.getElementById("messageInput"); if (i) i.focus(); return true; } catch (e) { return false; }
}

(function initAttach() {
    if (typeof document === "undefined") return;
    const input = document.getElementById("messageInput"), mic = document.getElementById("liveVoiceBtn");
    if (!input || !mic) return;
    const file = document.createElement("input"); file.type = "file"; file.accept = "image/png,image/jpeg,image/webp,image/gif"; file.hidden = true;
    const btn = document.createElement("button");
    btn.id = "attachBtn"; btn.type = "button"; btn.title = "Add a photo"; btn.setAttribute("aria-label", "Add a photo");
    btn.className = mic.className; btn.innerHTML = '<i class="fas fa-image text-sm md:text-base"></i>';
    btn.onclick = () => file.click();
    file.onchange = () => { if (file.files && file.files[0]) attachFile(file.files[0]); file.value = ""; };
    mic.insertAdjacentElement("afterend", btn); btn.insertAdjacentElement("afterend", file);
    input.addEventListener("paste", (e) => {
        const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => ATTACH_TYPES.test(x.type));
        if (f) { e.preventDefault(); attachFile(f); }
    });
    ["dragover", "drop"].forEach(ev => document.addEventListener(ev, (e) => {
        const has = e.dataTransfer && [...(e.dataTransfer.files || [])].some(x => ATTACH_TYPES.test(x.type));
        if (!has && ev === "dragover") return;
        e.preventDefault();
        if (ev === "drop") { const f = [...e.dataTransfer.files].find(x => ATTACH_TYPES.test(x.type)); if (f) attachFile(f); }
    }));
})();
