"""Verify a "Sign in with Google" ID token. Standard library only.

The browser gets a signed JWT from Google; we must never trust it until we have checked, here on the server:
  * the signature (RS256, against Google's published public keys),
  * the algorithm (only RS256: never "none" or a symmetric HS256 "signed with the public key" trick),
  * who it is for (`aud` must be OUR client id) and who issued it (`iss` must be Google),
  * that it has not expired, and that Google says the e-mail address is verified.
"""
import base64
import hashlib
import hmac
import json
import threading
import time
import urllib.request

JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("accounts.google.com", "https://accounts.google.com")
CLOCK_SKEW = 60                       # seconds of tolerated clock drift
MIN_CACHE, MAX_CACHE = 300, 86400     # how long fetched keys are trusted, seconds
REFETCH_COOLDOWN = 60                 # never hit Google more than once a minute because of unknown key ids
# DER prefix of a SHA-256 DigestInfo (RFC 8017, EMSA-PKCS1-v1_5)
_DIGEST_INFO_SHA256 = bytes.fromhex("3031300d060960864801650304020105000420")

_cache = {"keys": {}, "expires": 0.0, "fetched": 0.0}
_lock = threading.Lock()


class GoogleAuthError(Exception):
    """Raised for any token that must be refused. `code` is safe to log, never shown to the user."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _b64url(data):
    if not isinstance(data, str):
        raise GoogleAuthError("malformed")
    try:
        return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))
    except Exception:
        raise GoogleAuthError("malformed")


def _fetch_jwks(url, timeout=5):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read(200_000).decode("utf-8"))
        cache_control = resp.headers.get("Cache-Control", "") if hasattr(resp, "headers") else ""
    max_age = 3600
    for part in cache_control.split(","):
        part = part.strip().lower()
        if part.startswith("max-age="):
            try:
                max_age = int(part[8:])
            except ValueError:
                pass
    keys = {}
    for k in body.get("keys", []):
        if k.get("kty") == "RSA" and k.get("kid") and k.get("n") and k.get("e"):
            keys[k["kid"]] = (int.from_bytes(_b64url(k["n"]), "big"), int.from_bytes(_b64url(k["e"]), "big"))
    return keys, max(MIN_CACHE, min(max_age, MAX_CACHE))


def _get_key(kid, url, now):
    with _lock:
        if kid in _cache["keys"] and now < _cache["expires"]:
            return _cache["keys"][kid]
        # Unknown key id (or stale cache): refresh, but not more than once per cooldown.
        if now - _cache["fetched"] >= REFETCH_COOLDOWN or now >= _cache["expires"]:
            try:
                keys, ttl = _fetch_jwks(url)
            except Exception:
                raise GoogleAuthError("keys_unavailable")
            _cache.update(keys=keys, expires=now + ttl, fetched=now)
        return _cache["keys"].get(kid)


def reset_key_cache():
    with _lock:
        _cache.update(keys={}, expires=0.0, fetched=0.0)


def rsa_pkcs1_sha256_verify(n, e, signed, signature):
    """RSASSA-PKCS1-v1_5 verification (RFC 8017 section 8.2) with SHA-256."""
    k = (n.bit_length() + 7) // 8
    if len(signature) != k or e < 3:
        return False
    s = int.from_bytes(signature, "big")
    if s >= n:
        return False
    em = pow(s, e, n).to_bytes(k, "big")
    t = _DIGEST_INFO_SHA256 + hashlib.sha256(signed).digest()
    if k < len(t) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(t) - 3) + b"\x00" + t
    return hmac.compare_digest(em, expected)


def verify_id_token(token, client_id, now=None, jwks_url=None):
    """Return the verified claims, or raise GoogleAuthError."""
    now = time.time() if now is None else now
    if not client_id:
        raise GoogleAuthError("not_configured")
    if not isinstance(token, str) or len(token) > 8192 or token.count(".") != 2:
        raise GoogleAuthError("malformed")
    head_b64, payload_b64, sig_b64 = token.split(".")
    try:
        header = json.loads(_b64url(head_b64))
        claims = json.loads(_b64url(payload_b64))
    except (ValueError, UnicodeDecodeError):
        raise GoogleAuthError("malformed")
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise GoogleAuthError("malformed")

    if header.get("alg") != "RS256":                       # refuses "none", HS256, anything else
        raise GoogleAuthError("bad_alg")
    kid = header.get("kid")
    if not isinstance(kid, str):
        raise GoogleAuthError("no_kid")
    key = _get_key(kid, jwks_url or JWKS_URL, now)
    if key is None:
        raise GoogleAuthError("unknown_key")
    if not rsa_pkcs1_sha256_verify(key[0], key[1], f"{head_b64}.{payload_b64}".encode("ascii"), _b64url(sig_b64)):
        raise GoogleAuthError("bad_signature")

    # Signature is good: now check the claims.
    if claims.get("iss") not in ISSUERS:
        raise GoogleAuthError("bad_issuer")
    aud = claims.get("aud")
    if aud != client_id and not (isinstance(aud, list) and client_id in aud):
        raise GoogleAuthError("bad_audience")
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or isinstance(exp, bool) or now > exp + CLOCK_SKEW:
        raise GoogleAuthError("expired")
    iat = claims.get("iat")
    if isinstance(iat, (int, float)) and not isinstance(iat, bool) and iat > now + CLOCK_SKEW:
        raise GoogleAuthError("issued_in_future")
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise GoogleAuthError("no_subject")
    if not isinstance(claims.get("email"), str) or not claims["email"]:
        raise GoogleAuthError("no_email")
    if claims.get("email_verified") not in (True, "true"):
        raise GoogleAuthError("email_not_verified")
    return claims
