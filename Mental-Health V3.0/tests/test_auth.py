"""Accounts: sign-up, login, sessions, Google ID tokens, password reset, and the attacks we defend against."""
import base64
import json
import os
import sqlite3
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
import auth  # noqa: E402
import google_auth  # noqa: E402
from authhelper import use_temp_db  # noqa: E402
from rsa_helper import b64, jwks, make_key, make_token  # noqa: E402

CID = "client-123.apps.googleusercontent.com"
KEY = make_key()
OTHER_KEY = make_key(seed=2)


@pytest.fixture
def client(monkeypatch, tmp_path):
    use_temp_db(monkeypatch, tmp_path)
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("MINDSENCE_SMTP_HOST", raising=False)
    monkeypatch.delenv("GMAIL_ADDRESS", raising=False)
    monkeypatch.delenv("MINDSENCE_PUBLIC_URL", raising=False)
    backend.app.config["TESTING"] = True
    return backend.app.test_client()


def signup(c, email="a@example.com", password="correct horse 42", **kw):
    return c.post("/auth/signup", json={"email": email, "password": password, **kw})


# ---------- sign-up / login ----------
def test_api_is_closed_without_login(client):
    for path in ("/chat", "/tts", "/analyze-emotion", "/feedback"):
        res = client.post(path, json={"messages": [{"role": "user", "content": "hi"}], "text": "hi"})
        assert res.status_code == 401, path
    assert client.get("/health").status_code == 200           # status stays public (no secrets in it)
    assert client.get("/").status_code == 200                  # the page itself, so the login screen can load


def test_signup_then_session_then_logout(client):
    res = signup(client)
    assert res.status_code == 201 and res.get_json()["user"]["email"] == "a@example.com"
    cookie = res.headers.get("Set-Cookie", "")
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie
    assert client.get("/auth/me").get_json()["user"]["email"] == "a@example.com"
    assert client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code != 401
    assert client.post("/auth/logout", json={}).status_code == 200
    assert client.get("/auth/me").get_json()["user"] is None
    assert client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_logout_really_kills_the_session_server_side(client):
    signup(client)
    old = client.get_cookie(auth.COOKIE_NAME) if hasattr(client, "get_cookie") else None
    token = old.value if old else None
    client.post("/auth/logout", json={})
    if token:
        other = backend.app.test_client()
        other.set_cookie(auth.COOKIE_NAME, token)
        assert other.get("/auth/me").get_json()["user"] is None


def test_password_and_session_are_not_stored_in_plain_text(client, tmp_path):
    signup(client, password="correct horse 42")
    raw = open(str(tmp_path / "test.db"), "rb").read()
    assert b"correct horse 42" not in raw
    conn = sqlite3.connect(str(tmp_path / "test.db"))
    assert conn.execute("SELECT password_hash FROM users").fetchone()[0].startswith(("scrypt$", "pbkdf2$"))


def test_email_is_case_insensitive_and_unique(client):
    assert signup(client, "Person@Example.com").status_code == 201
    assert signup(backend.app.test_client(), "person@example.COM").status_code == 409


@pytest.mark.parametrize("email", ["", "nope", "a@b", "a b@c.de", None, 5, "x" * 300 + "@a.com"])
def test_invalid_emails_rejected(client, email):
    assert signup(client, email).status_code == 400


@pytest.mark.parametrize("pw", ["", "short", "password", "12345678", " " * 10, None, 12345678, "x" * 200])
def test_weak_passwords_rejected(client, pw):
    assert signup(client, password=pw).status_code == 400


def test_login_ok_and_wrong_password_look_the_same_as_unknown_email(client):
    signup(client)
    fresh = backend.app.test_client()
    bad = fresh.post("/auth/login", json={"email": "a@example.com", "password": "wrong password!"})
    unknown = fresh.post("/auth/login", json={"email": "nobody@example.com", "password": "wrong password!"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.get_json() == unknown.get_json()
    ok = fresh.post("/auth/login", json={"email": " A@Example.com ", "password": "correct horse 42"})
    assert ok.status_code == 200 and fresh.get("/auth/me").get_json()["user"]["email"] == "a@example.com"


def test_lockout_after_repeated_wrong_passwords(client):
    signup(client)
    c = backend.app.test_client()
    for _ in range(5):
        assert c.post("/auth/login", json={"email": "a@example.com", "password": "nope nope nope"}).status_code == 401
    locked = c.post("/auth/login", json={"email": "a@example.com", "password": "correct horse 42"})
    assert locked.status_code == 429                              # even the right password waits


def test_garbage_bodies_never_crash(client):
    for payload in ([], "x", 5, None, {"email": {"a": 1}, "password": ["x"]}):
        for path in ("/auth/signup", "/auth/login", "/auth/forgot", "/auth/reset", "/auth/google"):
            res = client.post(path, data=json.dumps(payload), content_type="application/json")
            assert res.status_code in (200, 400, 401, 429, 503), (path, payload, res.status_code)
            assert res.status_code != 200 or path == "/auth/forgot"
    assert client.post("/auth/login", data="email=a", content_type="application/x-www-form-urlencoded").status_code == 400


def test_sql_injection_is_just_a_wrong_login(client):
    signup(client)
    res = client.post("/auth/login", json={"email": "a@example.com' OR '1'='1", "password": "' OR '1'='1"})
    assert res.status_code == 401


def test_cross_site_requests_are_refused(client):
    res = client.post("/auth/signup", json={"email": "x@example.com", "password": "correct horse 42"},
                      headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    signup(client)
    res = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    ok = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers={"Origin": "http://localhost"})
    assert ok.status_code != 403


def test_expired_session_is_rejected(client, tmp_path):
    signup(client)
    conn = sqlite3.connect(str(tmp_path / "test.db"))
    conn.execute("UPDATE sessions SET expires_at = 1")
    conn.commit()
    assert client.get("/auth/me").get_json()["user"] is None
    assert client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_forged_cookie_is_rejected(client):
    client.set_cookie(auth.COOKIE_NAME, "a" * 43)
    assert client.get("/auth/me").get_json()["user"] is None
    client.set_cookie(auth.COOKIE_NAME, "x" * 5000)
    assert client.get("/auth/me").get_json()["user"] is None


def test_signup_rate_limit(client):
    codes = [signup(client, f"u{i}@example.com").status_code for i in range(12)]
    assert 429 in codes and codes[0] == 201


def test_auth_responses_are_not_cached(client):
    assert client.get("/auth/me").headers["Cache-Control"] == "no-store"


def test_config_endpoint(client, monkeypatch):
    assert client.get("/auth/config").get_json()["google_client_id"] is None
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CID)
    assert client.get("/auth/config").get_json()["google_client_id"] == CID
    assert client.get("/health").get_json()["auth"]["google"] is True


# ---------- Google ----------
@pytest.fixture
def google(client, monkeypatch, tmp_path):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CID)
    google_auth.reset_key_cache()
    monkeypatch.setattr(google_auth, "_fetch_jwks", lambda url, timeout=5: (
        {"test-kid": (KEY["n"], KEY["e"])}, 3600))
    return client


def claims(**kw):
    t = int(time.time())
    base = {"iss": "https://accounts.google.com", "aud": CID, "sub": "sub-1", "email": "g@example.com",
            "email_verified": True, "name": "Gee", "iat": t, "exp": t + 3600}
    base.update(kw)
    return {k: v for k, v in base.items() if v is not None}


def gl(c, token):
    return c.post("/auth/google", json={"credential": token})


def test_google_creates_account_and_signs_in(google):
    res = gl(google, make_token(KEY, claims()))
    assert res.status_code == 200 and res.get_json()["user"]["email"] == "g@example.com"
    assert google.get("/auth/me").get_json()["user"]["google"] is True
    again = backend.app.test_client()
    assert gl(again, make_token(KEY, claims())).status_code == 200      # same account on the second sign-in


@pytest.mark.parametrize("name,token_fn", [
    ("wrong key", lambda: make_token(OTHER_KEY, claims())),
    ("wrong audience", lambda: make_token(KEY, claims(aud="someone-else"))),
    ("wrong issuer", lambda: make_token(KEY, claims(iss="https://evil.example"))),
    ("expired", lambda: make_token(KEY, claims(exp=int(time.time()) - 3600))),
    ("unverified email", lambda: make_token(KEY, claims(email_verified=False))),
    ("no email", lambda: make_token(KEY, claims(email=None))),
    ("no subject", lambda: make_token(KEY, claims(sub=None))),
    ("alg none", lambda: make_token(KEY, claims(), alg="none")),
    ("alg HS256", lambda: make_token(KEY, claims(), alg="HS256")),
    ("unknown kid", lambda: make_token(KEY, claims(), kid="other")),
    ("not a jwt", lambda: "abc"),
    ("empty", lambda: ""),
])
def test_google_bad_tokens_are_refused(google, name, token_fn):
    res = gl(google, token_fn())
    assert res.status_code in (401, 400), name
    assert google.get("/auth/me").get_json()["user"] is None


def test_google_tampered_payload_is_refused(google):
    head, payload, sig = make_token(KEY, claims()).split(".")
    forged = json.loads(base64.urlsafe_b64decode(payload + "=="))
    forged["email"] = "admin@example.com"
    bad = f"{head}.{b64(json.dumps(forged).encode())}.{sig}"
    assert gl(google, bad).status_code == 401


def test_google_not_configured(client):
    assert gl(client, "x.y.z").status_code == 503


def test_google_keys_unreachable_is_503(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CID)
    google_auth.reset_key_cache()
    def boom(url, timeout=5):
        raise OSError("offline")
    monkeypatch.setattr(google_auth, "_fetch_jwks", boom)
    assert gl(client, make_token(KEY, claims())).status_code == 503


def test_google_signin_removes_unverified_password_squatter(google):
    squat = backend.app.test_client()
    assert signup(squat, "g@example.com", "attacker password 1").status_code == 201     # attacker pre-registers the victim's address
    victim = backend.app.test_client()
    res = gl(victim, make_token(KEY, claims()))
    assert res.status_code == 200 and res.get_json().get("notice") == "password_removed"
    assert squat.get("/auth/me").get_json()["user"] is None                            # attacker's session is gone
    login = backend.app.test_client().post("/auth/login", json={"email": "g@example.com", "password": "attacker password 1"})
    assert login.status_code == 401                                                      # and so is their password


def test_google_account_has_no_password_login(google):
    gl(google, make_token(KEY, claims()))
    res = backend.app.test_client().post("/auth/login", json={"email": "g@example.com", "password": "anything at all"})
    assert res.status_code == 401


def test_google_different_sub_same_email_refused(google):
    gl(google, make_token(KEY, claims(sub="sub-1")))
    assert gl(backend.app.test_client(), make_token(KEY, claims(sub="sub-2"))).status_code == 409


def test_rsa_verify_unit():
    from rsa_helper import sign_rs256
    sig = sign_rs256(KEY, b"hello")
    assert google_auth.rsa_pkcs1_sha256_verify(KEY["n"], KEY["e"], b"hello", sig)
    assert not google_auth.rsa_pkcs1_sha256_verify(KEY["n"], KEY["e"], b"hellO", sig)
    assert not google_auth.rsa_pkcs1_sha256_verify(KEY["n"], KEY["e"], b"hello", sig[:-1])
    assert not google_auth.rsa_pkcs1_sha256_verify(KEY["n"], KEY["e"], b"hello", b"\x00" * len(sig))


# ---------- password reset ----------
def grab_reset_token(monkeypatch):
    sent = {}
    class Inline:                                   # run the delivery synchronously and capture the link
        def __init__(self, target, args, daemon=None):
            self.target, self.args = target, args
        def start(self):
            self.target(*self.args)
    monkeypatch.setattr(auth.threading, "Thread", Inline)
    monkeypatch.setattr(auth, "send_email", lambda to, subject, text: sent.update(to=to, text=text))
    return sent


def test_reset_flow(client, monkeypatch):
    monkeypatch.setenv("MINDSENCE_SMTP_HOST", "smtp.test")
    monkeypatch.setenv("MINDSENCE_PUBLIC_URL", "https://site.example")
    sent = grab_reset_token(monkeypatch)
    signup(client)
    other_session = backend.app.test_client()
    other_session.post("/auth/login", json={"email": "a@example.com", "password": "correct horse 42"})
    assert client.post("/auth/forgot", json={"email": "a@example.com"}).status_code == 200
    token = sent["text"].split("?reset=")[1].split()[0]
    assert "https://site.example/?reset=" in sent["text"]
    res = backend.app.test_client().post("/auth/reset", json={"token": token, "password": "brand new pass 9"})
    assert res.status_code == 200
    assert other_session.get("/auth/me").get_json()["user"] is None                    # old sessions ended
    assert backend.app.test_client().post("/auth/login", json={"email": "a@example.com", "password": "brand new pass 9"}).status_code == 200
    assert backend.app.test_client().post("/auth/login", json={"email": "a@example.com", "password": "correct horse 42"}).status_code == 401
    again = backend.app.test_client().post("/auth/reset", json={"token": token, "password": "another pass 99"})
    assert again.status_code == 400                                                      # single use


def test_forgot_does_not_reveal_whether_an_account_exists(client, monkeypatch):
    monkeypatch.setenv("MINDSENCE_SMTP_HOST", "smtp.test")
    monkeypatch.setenv("MINDSENCE_PUBLIC_URL", "https://site.example")
    grab_reset_token(monkeypatch)
    signup(client)
    a = client.post("/auth/forgot", json={"email": "a@example.com"})
    b = client.post("/auth/forgot", json={"email": "ghost@example.com"})
    assert a.status_code == b.status_code == 200 and a.get_json() == b.get_json()


def test_reset_rejects_bad_expired_and_weak(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MINDSENCE_SMTP_HOST", "smtp.test")
    monkeypatch.setenv("MINDSENCE_PUBLIC_URL", "https://site.example")
    sent = grab_reset_token(monkeypatch)
    signup(client)
    client.post("/auth/forgot", json={"email": "a@example.com"})
    token = sent["text"].split("?reset=")[1].split()[0]
    assert client.post("/auth/reset", json={"token": "nope", "password": "brand new pass 9"}).status_code == 400
    assert client.post("/auth/reset", json={"token": token, "password": "short"}).status_code == 400
    conn = sqlite3.connect(str(tmp_path / "test.db"))
    conn.execute("UPDATE reset_tokens SET expires_at = 1")
    conn.commit()
    assert client.post("/auth/reset", json={"token": token, "password": "brand new pass 9"}).status_code == 400


def test_reset_link_without_public_url_is_not_built_from_host_header(client, monkeypatch):
    monkeypatch.setenv("MINDSENCE_SMTP_HOST", "smtp.test")
    monkeypatch.delenv("MINDSENCE_PUBLIC_URL", raising=False)
    sent = grab_reset_token(monkeypatch)
    signup(client)
    client.post("/auth/forgot", json={"email": "a@example.com"}, headers={"Host": "evil.example"})
    assert sent == {}


def test_password_hashing_roundtrip():
    h = auth.hash_password("pässwörd 密码")
    assert auth.verify_password("pässwörd 密码", h) and not auth.verify_password("other", h)
    assert not auth.verify_password("x", "garbage") and not auth.verify_password("x", "scrypt$1$2")
