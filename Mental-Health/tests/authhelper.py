"""Shared helper: a test client that is already signed in (the API now requires an account)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402
import auth  # noqa: E402


def use_temp_db(monkeypatch, tmp_path):
    monkeypatch.setenv("MINDSENCE_DB", str(tmp_path / "test.db"))
    auth.reset_limits()
    backend.audio_cache = backend.AudioCache()          # no speech cached from an earlier test


def signed_in_client(monkeypatch, tmp_path, email="tester@example.com", password="correct horse 42"):
    use_temp_db(monkeypatch, tmp_path)
    backend.app.config["TESTING"] = True
    c = backend.app.test_client()
    res = c.post("/auth/signup", json={"email": email, "password": password})
    assert res.status_code == 201, res.get_data(as_text=True)
    return c
