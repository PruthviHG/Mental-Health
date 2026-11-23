"""Outgoing e-mail for Mindsence: password-reset links and feedback. Standard library only.

Easiest setup is Gmail. Google does not accept your normal password for apps; create an *app password*
(Google Account -> Security -> 2-Step Verification -> App passwords) and set:

    GMAIL_ADDRESS=you@gmail.com
    GMAIL_APP_PASSWORD=abcd efgh ijkl mnop

`python tools/setup_mail.py` asks for both, sends a test message and saves them to .env.
Any other provider still works through the MINDSENCE_SMTP_* variables, which win when set.
"""
import base64
import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

GMAIL_HOST, GMAIL_PORT = "smtp.gmail.com", 587

# Where feedback is delivered. Kept on the server only; it is never sent to the browser or printed in logs.
_FEEDBACK_INBOX = base64.b64decode("YXNhczAxMjNhc2FzMDBAZ21haWwuY29t").decode()


def settings(env=None):
    """SMTP settings from the environment, or None when no mail account is configured."""
    env = os.environ if env is None else env
    host = (env.get("MINDSENCE_SMTP_HOST") or "").strip()
    if host:
        user = (env.get("MINDSENCE_SMTP_USER") or "").strip()
        return {"host": host, "port": int(env.get("MINDSENCE_SMTP_PORT") or 587), "user": user,
                "password": env.get("MINDSENCE_SMTP_PASSWORD", ""), "starttls": (env.get("MINDSENCE_SMTP_STARTTLS") or "1") != "0",
                "from": (env.get("MINDSENCE_SMTP_FROM") or user or "mindsence@localhost")}
    user = (env.get("GMAIL_ADDRESS") or "").strip()
    password = "".join((env.get("GMAIL_APP_PASSWORD") or "").split())           # Google shows it in groups of four
    if user and password:
        return {"host": GMAIL_HOST, "port": GMAIL_PORT, "user": user, "password": password, "starttls": True,
                "from": f"Mindsence <{user}>"}
    return None


def configured(env=None):
    return settings(env) is not None


def feedback_inbox(env=None):
    env = os.environ if env is None else env
    return (env.get("MINDSENCE_FEEDBACK_TO") or "").strip() or _FEEDBACK_INBOX


def one_line(text, limit=120):
    return " ".join(str(text).split())[:limit]


def send(to, subject, text, reply_to=None, env=None):
    """Send one plain-text message. Raises on failure (callers decide what to tell the person)."""
    cfg = settings(env)
    if cfg is None:
        raise RuntimeError("e-mail is not configured")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = cfg["from"], to, one_line(subject, 200)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
        if cfg["starttls"]:
            smtp.starttls(context=ssl.create_default_context())
        if cfg["user"]:
            smtp.login(cfg["user"], cfg["password"])
        smtp.send_message(msg)


class NeedsActivation(RuntimeError):
    """The relay has not been activated by the inbox owner yet (one click in a one-time e-mail)."""


def relay(to, subject, text, reply_to=None, timeout=20):
    """Send through the FormSubmit relay: no account, password or terminal setup on this computer.
    The first message makes the relay e-mail the inbox owner a one-time activation link."""
    payload = {"_subject": one_line(subject, 200), "message": text, "_captcha": "false", "_template": "box"}
    if reply_to:
        payload["email"] = reply_to
    req = urllib.request.Request("https://formsubmit.co/ajax/" + to, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mindsence/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as res:
        data = json.loads(res.read().decode("utf-8", "replace") or "{}")
    ok = str(data.get("success", "")).lower() == "true"
    if not ok:
        if "activat" in str(data.get("message", "")).lower():
            raise NeedsActivation("relay needs activation")
        raise RuntimeError("relay refused the message")
