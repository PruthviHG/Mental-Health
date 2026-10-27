"""Tiny RSA key generator + RS256 signer, so tests can mint fake 'Google' ID tokens with no extra packages."""
import base64
import hashlib
import json
import random

_DI = bytes.fromhex("3031300d060960864801650304020105000420")


def _is_prime(n, rnd):
    if n < 4:
        return n in (2, 3)
    if n % 2 == 0:
        return False
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for _ in range(24):
        a = rnd.randrange(2, n - 1)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def _prime(bits, rnd):
    while True:
        c = rnd.getrandbits(bits) | (1 << (bits - 1)) | 1
        if _is_prime(c, rnd):
            return c


def make_key(bits=1024, seed=1):
    rnd = random.Random(seed)
    e = 65537
    while True:
        p, q = _prime(bits // 2, rnd), _prime(bits // 2, rnd)
        if p != q and (p - 1) % e and (q - 1) % e:
            n = p * q
            if n.bit_length() == bits:
                return {"n": n, "e": e, "d": pow(e, -1, (p - 1) * (q - 1))}


def b64(data):
    if isinstance(data, int):
        data = data.to_bytes((data.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def sign_rs256(key, signed):
    k = (key["n"].bit_length() + 7) // 8
    t = _DI + hashlib.sha256(signed).digest()
    em = b"\x00\x01" + b"\xff" * (k - len(t) - 3) + b"\x00" + t
    return pow(int.from_bytes(em, "big"), key["d"], key["n"]).to_bytes(k, "big")


def make_token(key, claims, kid="test-kid", alg="RS256"):
    head = b64(json.dumps({"alg": alg, "kid": kid, "typ": "JWT"}).encode())
    payload = b64(json.dumps(claims).encode())
    sig = b64(sign_rs256(key, f"{head}.{payload}".encode()))
    return f"{head}.{payload}.{sig}"


def jwks(key, kid="test-kid"):
    return {"keys": [{"kty": "RSA", "kid": kid, "alg": "RS256", "use": "sig", "n": b64(key["n"]), "e": b64(key["e"])}]}
