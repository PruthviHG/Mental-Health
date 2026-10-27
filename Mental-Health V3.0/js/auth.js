// ==========================================
// --- ACCOUNTS: sign in / sign up with email or Google ---
// The server owns all security (hashing, sessions, Google token checks). This file is only the screen:
// it shows the form, sends JSON to /auth/*, and keeps the chat locked until the server says we are signed in.
// The session lives in an HttpOnly cookie that scripts cannot read, so nothing secret is kept here.
// ==========================================
const AUTH_URL = `${MINDSENCE.backendUrl}/auth`;
const authState = { user: null, ready: false, mode: "signin", config: null, resetToken: null, lastEmail: null, googleLoaded: false, busy: false };
const EMAIL_PATTERN = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

function authLocked() { return !authState.user; }
const _el = (id) => document.getElementById(id);

async function authApi(path, body) {
    const opt = body === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    let res;
    try { res = await fetch(`${AUTH_URL}${path}`, { ...opt, credentials: "same-origin", cache: "no-store" }); }
    catch (e) { return { ok: false, status: 0, data: { detail: "Can't reach the server. Check your connection and try again." } }; }
    let data = {};
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    return { ok: res.ok, status: res.status, data };
}

// ----- screen state -----
function setAuthText(el, key) { el.dataset.i18n = key; el.textContent = t(key); }
function showAuthError(msg) { const e = _el("auth-error"); e.textContent = msg || ""; e.classList.toggle("hidden", !msg); }
function showAuthNotice(msg) { const e = _el("auth-notice"); e.textContent = msg || ""; e.classList.toggle("hidden", !msg); }

function setAuthMode(mode) {
    authState.mode = mode;
    const pass = _el("auth-pass"), emailLabel = document.querySelector('label[for="auth-email"]');
    const signup = mode === "signup", forgot = mode === "forgot", reset = mode === "reset";
    _el("auth-email").classList.toggle("hidden", reset);
    emailLabel.classList.toggle("hidden", reset);
    _el("auth-pass-row").classList.toggle("hidden", forgot);
    pass.autocomplete = (signup || reset) ? "new-password" : "current-password";
    setAuthText(_el("auth-pass-label"), reset ? "aNewPass" : "aPass");
    setAuthText(_el("auth-submit"), signup ? "aSignUp" : forgot ? "aSendLink" : reset ? "aReset" : "aSignIn");
    setAuthText(_el("auth-switch"), (forgot || reset) ? "aBack" : signup ? "aSwitchIn" : "aSwitchUp");
    _el("auth-forgot").classList.toggle("hidden", mode !== "signin");
    _el("auth-google-wrap").classList.toggle("hidden", !(authState.googleLoaded && (mode === "signin" || signup)));
    showAuthError("");
    if (mode !== "forgot") showAuthNotice(mode === "reset" ? "" : _el("auth-notice").textContent);
}

function showAuth(notice) {
    document.body.classList.add("auth-locked");
    const ov = _el("auth-overlay");
    ov.classList.remove("hidden");
    if (notice !== undefined) showAuthNotice(notice);
    const first = authState.mode === "reset" ? _el("auth-pass") : _el("auth-email");
    setTimeout(() => { try { first.focus(); } catch (e) { /* ignore */ } }, 50);
}

function unlockApp(user, notice) {
    if (authState.lastEmail && authState.lastEmail !== user.email && typeof clearChatSilently === "function") clearChatSilently();
    authState.user = user; authState.lastEmail = user.email;
    if (typeof companionOnUnlock === "function") companionOnUnlock();
    document.body.classList.remove("auth-locked");
    _el("auth-overlay").classList.add("hidden");
    _el("auth-pass").value = "";
    showAuthError(""); showAuthNotice("");
    const chip = _el("user-chip");
    chip.textContent = `${user.name || user.email} ⏻`;
    chip.title = `${user.email} - ${t("aLogout")}`;
    chip.classList.remove("hidden");
    if (typeof offerOnDeviceAi === "function") offerOnDeviceAi();
    if (notice) toast(notice);
    if (typeof checkStatus === "function") checkStatus();
}

function lockApp(notice) {
    authState.user = null;
    _el("user-chip").classList.add("hidden");
    if (typeof stopAI === "function") { try { stopAI(); } catch (e) { /* ignore */ } }
    setAuthMode("signin");
    showAuth(notice);
}

// Called by other scripts when the server answers 401 (for example the session expired).
function onUnauthenticated() {
    if (authLocked()) return;
    lockApp("Your session ended. Please sign in again.");
}

function toast(msg) {
    const d = document.createElement("div");
    d.setAttribute("role", "status");
    d.textContent = msg;
    d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:90vw;z-index:300;padding:10px 14px;font:12px 'JetBrains Mono',monospace;color:#fde68a;background:rgba(10,18,30,.95);border:1px solid rgba(251,191,36,.4);border-radius:8px";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 9000);
}

// ----- actions -----
function validateAuthForm(mode, email, pass) {
    if (mode !== "reset" && !EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";
    if (mode === "forgot") return "";
    if (!pass) return "Please enter your password.";
    if ((mode === "signup" || mode === "reset") && pass.length < 8) return "Use at least 8 characters.";
    return "";
}

async function submitAuth(ev) {
    ev.preventDefault();
    if (authState.busy) return;
    const mode = authState.mode;
    const email = _el("auth-email").value.trim(), pass = _el("auth-pass").value;
    const problem = validateAuthForm(mode, email, pass);
    if (problem) { showAuthError(problem); return; }
    authState.busy = true; _el("auth-submit").disabled = true; showAuthError("");
    try {
        if (mode === "forgot") {
            const r = await authApi("/forgot", { email });
            if (r.ok) { showAuthNotice(t("aSent")); setAuthMode("signin"); showAuthNotice(t("aSent")); }
            else showAuthError(r.data.detail || "Something went wrong. Please try again.");
            return;
        }
        const path = mode === "signup" ? "/signup" : mode === "reset" ? "/reset" : "/login";
        const body = mode === "reset" ? { token: authState.resetToken, password: pass } : { email, password: pass };
        const r = await authApi(path, body);
        if (r.ok && r.data.user) {
            if (mode === "reset") { authState.resetToken = null; try { history.replaceState(null, "", location.pathname); } catch (e) { /* ignore */ } }
            unlockApp(r.data.user);
        } else showAuthError(r.data.detail || "Something went wrong. Please try again.");
    } finally {
        authState.busy = false; _el("auth-submit").disabled = false;
    }
}

async function googleSignIn(credential) {
    if (authState.busy || !credential) return;
    authState.busy = true; showAuthError("");
    try {
        const r = await authApi("/google", { credential });
        if (r.ok && r.data.user) {
            unlockApp(r.data.user, r.data.notice === "password_removed"
                ? "For your security, an old password on this email was removed because Google confirmed the address is yours." : "");
        } else showAuthError(r.data.detail || "Google sign-in failed. Please try again or use email.");
    } finally { authState.busy = false; }
}

async function signOut() {
    await authApi("/logout", {});
    if (typeof clearChatSilently === "function") clearChatSilently();     // a shared device must not keep the conversation
    authState.lastEmail = null;
    lockApp("");
}

// ----- Google button (loaded only when the server has a client id) -----
function loadGoogleButton(clientId) {
    if (!clientId || authState.googleLoaded) return;
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
    s.onload = () => {
        try {
            window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => googleSignIn(r && r.credential), ux_mode: "popup", auto_select: false });
            window.google.accounts.id.renderButton(_el("auth-google-btn"), { theme: "filled_black", size: "large", text: "continue_with", shape: "pill", width: 280, locale: uiLang });
            authState.googleLoaded = true;
            setAuthMode(authState.mode);
        } catch (e) { console.warn("Google sign-in unavailable:", e && e.message); }
    };
    s.onerror = () => console.warn("Google sign-in script could not load (blocked or offline). Email sign-in still works.");
    document.head.appendChild(s);
}

// ----- start-up -----
async function initAuth() {
    if (typeof document === "undefined" || !_el("auth-overlay")) return;
    document.body.classList.add("auth-locked");
    _el("auth-form").addEventListener("submit", submitAuth);
    _el("auth-forgot").addEventListener("click", () => setAuthMode("forgot"));
    _el("auth-switch").addEventListener("click", () => setAuthMode(authState.mode === "signin" ? "signup" : "signin"));

    const params = new URLSearchParams(location.search);
    const resetToken = params.get("reset");
    if (resetToken) { authState.resetToken = resetToken.slice(0, 200); }

    const [me, cfg] = await Promise.all([authApi("/me"), authApi("/config")]);
    authState.ready = true;
    if (cfg.ok) { authState.config = cfg.data; loadGoogleButton(cfg.data.google_client_id); }
    if (authState.resetToken) { setAuthMode("reset"); showAuth(); return; }
    setAuthMode("signin");
    if (me.ok && me.data.user) { unlockApp(me.data.user); return; }
    showAuth(me.ok ? "" : (me.data.detail || "Can't reach the server. Start it with: python app.py"));
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAuth); else initAuth();
}
