"""Set up Gmail sending for Mindsence (password-reset e-mails and feedback).

    python tools/setup_mail.py            # asks for your Gmail address and an app password, tests, saves to .env
    python tools/setup_mail.py --if-new   # only asks once (used by run.bat); press Enter to skip

Google does not accept your normal password here. Create an app password:
  Google Account -> Security -> turn on 2-Step Verification -> App passwords.
"""
import getpass
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, ".env")
sys.path.insert(0, ROOT)
import mailer  # noqa: E402


def read_env():
    try:
        with open(ENV, encoding="utf-8") as f:
            return f.read().splitlines()
    except OSError:
        return []


def set_vars(values):
    lines = read_env()
    for key, val in values.items():
        new = f"{key}={val}"
        for i, line in enumerate(lines):
            if line.split("=", 1)[0].strip() == key:
                lines[i] = new
                break
        else:
            lines.append(new)
    with open(ENV, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def has(key):
    return any(l.split("=", 1)[0].strip() == key and l.split("=", 1)[1].strip() for l in read_env() if "=" in l and not l.lstrip().startswith("#"))


def main(argv):
    if os.environ.get("MINDSENCE_SKIP_MAIL") == "1":
        return 0
    if "--if-new" in argv and (has("GMAIL_APP_PASSWORD") or has("MINDSENCE_SMTP_HOST") or has("MINDSENCE_MAIL_ASKED") or not sys.stdin.isatty()):
        return 0
    print("Mindsence e-mail setup (Gmail)")
    print("------------------------------")
    print("Used for password-reset e-mails and feedback. Press Enter to skip; run this file any time later.")
    print("You need a Gmail *app password*: Google Account > Security > 2-Step Verification > App passwords.\n")
    address = input("Gmail address: ").strip()
    if not address:
        set_vars({"MINDSENCE_MAIL_ASKED": "1"})
        print("  Skipped. Reset links will be printed in this window; feedback is saved in feedback_log.jsonl.")
        return 0
    password = getpass.getpass("App password (typing is hidden): ").strip()
    env = {"GMAIL_ADDRESS": address, "GMAIL_APP_PASSWORD": password}
    try:
        mailer.send(address, "Mindsence e-mail is working", "This is a test from Mindsence. Gmail sending is set up.", env=env)
    except Exception as e:
        print(f"\n  Could not send a test e-mail ({type(e).__name__}). Check the address and the app password, then run this again.")
        set_vars({"MINDSENCE_MAIL_ASKED": "1"})
        return 1
    set_vars({"GMAIL_ADDRESS": address, "GMAIL_APP_PASSWORD": password.replace(" ", ""), "MINDSENCE_MAIL_ASKED": "1"})
    print("\n  Done. A test e-mail was sent to you and the settings are saved in .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
