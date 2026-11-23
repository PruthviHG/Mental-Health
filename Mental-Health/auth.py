"""Accounts for Mindsence: e-mail + password, and "Sign in with Google". Standard library only.

Design notes (what keeps this safe):
  * Passwords are hashed with scrypt (PBKDF2 fallback), never stored or logged in plain text.
  * The browser only ever holds a random session id in an HttpOnly, SameSite=Lax cookie (JavaScript cannot read it).
    The server stores only a hash of it, so a leaked database cannot be used to log in.
  * Login errors are identical for "no such account" and "wrong password", and take the same time.
  * Repeated failures lock an e-mail address for a while; every endpoint is rate limited.
  * Unsafe requests must come from our own origin (CSRF) and be JSON.
  * Google ID tokens are verified locally (signature, audience, issuer, expiry); see google_auth.py.
  * No conversation text is stored here: accounts only hold who you are, nothing about what you said.
"""
import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
import sqlite3
import threading
import time
from collections import deque
from contextlib import closing
from functools import wraps
from urllib.parse import urlparse

from flask import Blueprint, g, jsonify, make_response, request

import google_auth
import mailer

log = logging.getLogger("mindsence.auth")
bp = Blueprint("auth", __name__, url_prefix="/auth")

COOKIE_NAME = "mindsence_session"
SESSION_DAYS = 30
RESET_MINUTES = 60
MIN_PASSWORD, MAX_PASSWORD = 8, 128
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
COMMON_PASSWORDS = {"password", "password1", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "11111111",
                    "00000000", "iloveyou", "abcd1234", "letmein1", "welcome1", "admin123", "mindsence"}

_schema_ready = set()
_schema_lock = threading.Lock()


def now():
    return int(time.time())


# ------------------------------------------------------------------
# Configuration (read on every call so tests and .env changes apply)
# ------------------------------------------------------------------
def db_path():
    return os.environ.get("MINDSENCE_DB") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "mindsence.db")


def google_client_id():
    return (os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("MINDSENCE_GOOGLE_CLIENT_ID") or "").strip() or None


def public_url():
    return (os.environ.get("MINDSENCE_PUBLIC_URL") or "").strip().rstrip("/") or None


def smtp_configured():
    return mailer.configured()


def cookie_secure():
    flag = (os.environ.get("MINDSENCE_COOKIE_SECURE") or "").strip().lower()
    if flag in ("1", "true", "yes"):
        return True
    if flag in ("0", "false", "no"):
        return False
    return request.is_secure or (public_url() or "").startswith("https://")


# ------------------------------------------------------------------
# Database
# ------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_sub TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
);
"""


def connect():
    path = db_path()
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    with _schema_lock:
        if path not in _schema_ready:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)
            conn.commit()
            _schema_ready.add(path)
    return conn


def sha256_hex(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ------------------------------------------------------------------
# Passwords
# ------------------------------------------------------------------
def hash_password(password):
    salt = os.urandom(16)
    b64 = lambda b: base64.b64encode(b).decode("ascii")
    try:
        n, r, p = 2 ** 14, 8, 1
        dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=32, maxmem=64 * 1024 * 1024)
        return f"scrypt${n}${r}${p}${b64(salt)}${b64(dk)}"
    except (AttributeError, ValueError, MemoryError):          # Python built without scrypt
        iters = 600_000
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, dklen=32)
        return f"pbkdf2${iters}${b64(salt)}${b64(dk)}"


def verify_password(password, stored):
    try:
        parts = stored.split("$")
        if parts[0] == "scrypt":
            _, n, r, p, salt, expected = parts
            dk = hashlib.scrypt(password.encode("utf-8"), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                                dklen=32, maxmem=64 * 1024 * 1024)
        elif parts[0] == "pbkdf2":
            _, iters, salt, expected = parts
            dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), base64.b64decode(salt), int(iters), dklen=32)
        else:
            return False
        return hmac.compare_digest(dk, base64.b64decode(expected))
    except Exception:
        return False


_dummy_hash = None


def burn_time(password):
    """Spend the same time as a real check, so 'unknown e-mail' cannot be told apart by timing."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("not-a-real-password")
    verify_password(password, _dummy_hash)


def clean_email(value):
    if not isinstance(value, str):
        return None
    email = value.strip().lower()
    return email if len(email) <= 254 and EMAIL_RE.match(email) else None


def password_problem(password, email=None):
    if not isinstance(password, str):
        return "Please enter a password."
    if len(password) < MIN_PASSWORD:
        return f"Use at least {MIN_PASSWORD} characters."
    if len(password) > MAX_PASSWORD:
        return f"Use at most {MAX_PASSWORD} characters."
    if not password.strip():
        return "The password can't be only spaces."
    if password.lower() in COMMON_PASSWORDS or (email and password.lower() == email):
        return "That password is too easy to guess. Please pick another."
    return None


def clean_name(value):
    if not isinstance(value, str):
        return None
    name = re.sub(r"[\x00-\x1f\x7f<>]", "", value).strip()[:60]
    return name or None


# ------------------------------------------------------------------
# Rate limiting and lockout (in memory, per process)
# ------------------------------------------------------------------
class Window:
    def __init__(self, limit, seconds):
        self.limit, self.seconds, self.hits, self.lock = limit, seconds, {}, threading.Lock()

    def allow(self, key, at=None):
        at = time.monotonic() if at is None else at
        with self.lock:
            q = self.hits.setdefault(key, deque())
            while q and at - q[0] > self.seconds:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(at)
            if len(self.hits) > 5000:
                for k in [k for k, v in self.hits.items() if not v or at - v[-1] > self.seconds]:
                    self.hits.pop(k, None)
            return True

    def count(self, key, at=None):
        at = time.monotonic() if at is None else at
        with self.lock:
            q = self.hits.get(key, deque())
            return sum(1 for t in q if at - t <= self.seconds)

    def clear(self, key):
        with self.lock:
            self.hits.pop(key, None)


login_ip = Window(30, 600)          # login attempts per IP per 10 minutes
signup_ip = Window(10, 3600)        # new accounts per IP per hour
google_ip = Window(30, 600)
forgot_ip = Window(8, 3600)
forgot_email = Window(3, 3600)
failed_logins = Window(5, 900)      # failed password attempts per e-mail per 15 minutes -> temporary lock


def reset_limits():
    for w in (login_ip, signup_ip, google_ip, forgot_ip, forgot_email, failed_logins):
        w.hits.clear()


def client_ip():
    return request.remote_addr or "unknown"


# ------------------------------------------------------------------
# Sessions
# ------------------------------------------------------------------
def create_session(conn, user_id):
    token = secrets.token_urlsafe(32)
    t = now()
    conn.execute("DELETE FROM sessions WHERE expires_at < ?", (t,))                    # tidy up
    conn.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen) VALUES (?,?,?,?,?)",
                 (sha256_hex(token), user_id, t, t + SESSION_DAYS * 86400, t))
    return token


def attach_cookie(resp, token):
    resp.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="Lax",
                    secure=cookie_secure(), path="/")
    return resp


def clear_cookie(resp):
    resp.set_cookie(COOKIE_NAME, "", max_age=0, expires=0, httponly=True, samesite="Lax", secure=cookie_secure(), path="/")
    return resp


def public_user(row):
    return {"id": row["id"], "email": row["email"], "name": row["name"], "google": bool(row["google_sub"]),
            "has_password": bool(row["password_hash"])}


def current_user():
    """The signed-in user for this request (a dict), or None. Cached for the request."""
    if hasattr(g, "_auth_user"):
        return g._auth_user
    g._auth_user = None
    token = request.cookies.get(COOKIE_NAME)
    if token and len(token) < 200:
        with closing(connect()) as conn:
            t = now()
            row = conn.execute(
                "SELECT u.*, s.expires_at AS s_exp, s.last_seen AS s_seen FROM sessions s JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = ?", (sha256_hex(token),)).fetchone()
            if row and row["s_exp"] > t:
                g._auth_user = public_user(row)
                if t - row["s_seen"] > 86400:                                      # sliding expiry, at most one write a day
                    with conn:
                        conn.execute("UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?",
                                     (t, t + SESSION_DAYS * 86400, sha256_hex(token)))
    return g._auth_user


def same_origin_ok():
    """CSRF guard for requests that change state: a browser always sends Origin on cross-site POSTs."""
    origin = request.headers.get("Origin")
    if origin is None:
        return True                                    # same-origin form/fetch without Origin, or a non-browser client
    host = urlparse(origin).netloc
    allowed = {request.host}
    if public_url():
        allowed.add(urlparse(public_url()).netloc)
    return host in allowed


def login_required(fn):
    """Protect an API route: needs a valid session; unsafe methods must also pass the origin check."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method not in ("GET", "HEAD", "OPTIONS") and not same_origin_ok():
            return jsonify({"error": "bad_origin"}), 403
        if current_user() is None:
            return jsonify({"error": "unauthenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper


@bp.before_request
def guard_auth_posts():
    if request.method == "POST":
        if not same_origin_ok():
            return jsonify({"error": "bad_origin"}), 403
        if not request.is_json:
            return jsonify({"error": "bad_request", "detail": "Send JSON."}), 400


@bp.after_request
def no_store(resp):
    resp.headers["Cache-Control"] = "no-store"
    return resp


def body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def err(code, status, detail=""):
    return jsonify({"error": code, "detail": detail}), status


def signed_in(conn, user_row, status=200, extra=None):
    token = create_session(conn, user_row["id"])
    payload = {"user": public_user(user_row)}
    payload.update(extra or {})
    resp = make_response(jsonify(payload), status)
    return attach_cookie(resp, token)


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@bp.get("/config")
def config():
    return jsonify({"google_client_id": google_client_id(), "reset_mode": "email" if smtp_configured() else "console",
                    "password_min": MIN_PASSWORD})


@bp.get("/me")
def me():
    return jsonify({"user": current_user()})          # 200 with null when signed out: no scary red errors in the console


@bp.post("/signup")
def signup():
    if not signup_ip.allow(client_ip()):
        return err("rate_limited", 429, "Too many sign-ups from here. Please try again later.")
    data = body()
    email = clean_email(data.get("email"))
    if not email:
        return err("invalid_email", 400, "Please enter a valid email address.")
    password = data.get("password")
    problem = password_problem(password, email)
    if problem:
        return err("weak_password", 400, problem)
    pw_hash = hash_password(password)
    try:
        with closing(connect()) as conn, conn:
            cur = conn.execute("INSERT INTO users (email, password_hash, name, created_at) VALUES (?,?,?,?)",
                               (email, pw_hash, clean_name(data.get("name")), now()))
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
            return signed_in(conn, row, 201)
    except sqlite3.IntegrityError:
        return err("email_taken", 409, "An account with this email already exists. Try signing in.")


@bp.post("/login")
def login():
    if not login_ip.allow(client_ip()):
        return err("rate_limited", 429, "Too many attempts. Please wait a few minutes.")
    data = body()
    email, password = clean_email(data.get("email")), data.get("password")
    if not email or not isinstance(password, str) or not password or len(password) > 1024:
        return err("invalid_credentials", 401, "Incorrect email or password.")
    if failed_logins.count(email) >= failed_logins.limit:
        burn_time(password)
        return err("locked", 429, "Too many wrong passwords. Please wait 15 minutes, or reset your password.")
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        stored = row["password_hash"] if row else None
        if stored:
            ok = verify_password(password, stored)
        else:
            burn_time(password)
            ok = False
        if not ok:
            failed_logins.allow(email)                                           # records the failure
            return err("invalid_credentials", 401, "Incorrect email or password.")
        failed_logins.clear(email)
        return signed_in(conn, row)


@bp.post("/logout")
def logout():
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with closing(connect()) as conn, conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (sha256_hex(token),))
    return clear_cookie(make_response(jsonify({"ok": True})))


@bp.post("/google")
def google_login():
    if not google_ip.allow(client_ip()):
        return err("rate_limited", 429, "Too many attempts. Please wait a few minutes.")
    client_id = google_client_id()
    if not client_id:
        return err("google_not_configured", 503, "Google sign-in isn't set up on this server.")
    try:
        claims = google_auth.verify_id_token(body().get("credential"), client_id, jwks_url=os.environ.get("MINDSENCE_GOOGLE_JWKS_URL"))
    except google_auth.GoogleAuthError as exc:
        log.warning("Google sign-in refused: %s", exc.code)
        status = 503 if exc.code == "keys_unavailable" else 401
        return err("google_failed", status, "Google sign-in failed. Please try again or use email.")
    email = clean_email(claims["email"])
    if not email:
        return err("google_failed", 401, "Google sign-in failed. Please try again or use email.")
    sub, notice = claims["sub"], None
    try:
        with closing(connect()) as conn, conn:
            row = conn.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
            if row is None:
                row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if row is None:
                    cur = conn.execute("INSERT INTO users (email, google_sub, email_verified, name, created_at) VALUES (?,?,1,?,?)",
                                       (email, sub, clean_name(claims.get("name")), now()))
                    row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
                else:
                    if row["google_sub"] and row["google_sub"] != sub:
                        return err("google_failed", 409, "This email is linked to a different Google account.")
                    # Google has proved this person controls the address. A password account we never verified may have been
                    # created by someone else, so its password is removed and old sessions are ended (account-takeover defence).
                    if row["password_hash"] and not row["email_verified"]:
                        conn.execute("UPDATE users SET password_hash = NULL WHERE id = ?", (row["id"],))
                        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
                        notice = "password_removed"
                    conn.execute("UPDATE users SET google_sub = ?, email_verified = 1, name = COALESCE(name, ?) WHERE id = ?",
                                 (sub, clean_name(claims.get("name")), row["id"]))
                    row = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
            return signed_in(conn, row, extra={"notice": notice} if notice else None)
    except sqlite3.IntegrityError:
        return err("google_failed", 409, "Google sign-in failed. Please try again.")


# ----- password reset -----
def reset_link(token):
    base = public_url()
    if not base:
        if smtp_configured():
            return None                                                          # never build e-mailed links from the Host header
        base = f"http://localhost:{os.environ.get('MINDSENCE_PORT') or os.environ.get('PORT') or '5000'}"
    return f"{base}/?reset={token}"


def send_email(to, subject, text):
    mailer.send(to, subject, text)


def deliver_reset(email, token):
    """E-mail the reset link (or, with no SMTP set up, print it in the server console: fine for your own machine)."""
    link = reset_link(token)
    if link is None:
        log.error("Cannot send reset e-mail: set MINDSENCE_PUBLIC_URL (e.g. https://your-site.example).")
        return
    if not smtp_configured():
        log.warning("PASSWORD RESET LINK for %s (valid %d min): %s", email, RESET_MINUTES, link)
        return
    text = (f"Someone asked to reset your Mindsence password.\n\nOpen this link within {RESET_MINUTES} minutes:\n{link}\n\n"
            "If this wasn't you, you can ignore this email. Your password stays the same.")
    try:
        send_email(email, "Reset your Mindsence password", text)
    except Exception:
        log.exception("Could not send the reset e-mail")


@bp.post("/forgot")
def forgot():
    if not forgot_ip.allow(client_ip()):
        return err("rate_limited", 429, "Too many requests. Please try again later.")
    email = clean_email(body().get("email"))
    generic = jsonify({"ok": True, "reset_mode": "email" if smtp_configured() else "console"})
    if not email or not forgot_email.allow(email):
        return generic                                                           # same answer: nothing to learn from it
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            token = secrets.token_urlsafe(32)
            conn.execute("DELETE FROM reset_tokens WHERE user_id = ?", (row["id"],))
            conn.execute("INSERT INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)",
                         (sha256_hex(token), row["id"], now() + RESET_MINUTES * 60))
            threading.Thread(target=deliver_reset, args=(email, token), daemon=True).start()
    return generic


@bp.post("/reset")
def reset():
    if not login_ip.allow(client_ip()):
        return err("rate_limited", 429, "Too many attempts. Please wait a few minutes.")
    data = body()
    token, password = data.get("token"), data.get("password")
    if not isinstance(token, str) or not token or len(token) > 200:
        return err("invalid_token", 400, "This reset link is invalid or has expired.")
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT r.user_id, r.expires_at, r.used, u.email FROM reset_tokens r JOIN users u ON u.id = r.user_id "
                           "WHERE r.token_hash = ?", (sha256_hex(token),)).fetchone()
        if not row or row["used"] or row["expires_at"] < now():
            return err("invalid_token", 400, "This reset link is invalid or has expired.")
        problem = password_problem(password, row["email"])
        if problem:
            return err("weak_password", 400, problem)
        conn.execute("UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?", (hash_password(password), row["user_id"]))
        conn.execute("UPDATE reset_tokens SET used = 1 WHERE user_id = ?", (row["user_id"],))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["user_id"],))      # sign out everywhere else
        failed_logins.clear(row["email"])
        user = conn.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone()
        return signed_in(conn, user)
