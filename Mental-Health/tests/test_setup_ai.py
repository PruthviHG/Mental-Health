"""tools/setup_ai.py: model choice by memory, and the install / start / pull / verify flow with a fake Ollama."""
import os
import sys

import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, "tools"))
import setup_ai  # noqa: E402


def test_model_fits_the_memory():
    assert setup_ai.choose_model(16)[0] == "qwen2.5:3b"
    assert setup_ai.choose_model(8)[0] == "qwen2.5:3b"
    assert setup_ai.choose_model(7.9)[0] == "qwen2.5:1.5b"
    assert setup_ai.choose_model(4)[0] == "qwen2.5:1.5b"
    assert setup_ai.choose_model(3.9)[0] == "qwen2.5:0.5b"
    assert setup_ai.choose_model(1)[0] == "qwen2.5:0.5b"
    assert setup_ai.choose_model(None)[0] == "qwen2.5:1.5b"           # unknown memory: the safe middle


def test_has_model_matches_tags():
    assert setup_ai.has_model(["qwen2.5:3b"], "qwen2.5:3b")
    assert setup_ai.has_model(["qwen2.5:3b-instruct-q4_K_M"], "qwen2.5:3b")
    assert not setup_ai.has_model(["qwen2.5:1.5b"], "qwen2.5:3b")
    assert not setup_ai.has_model([], "qwen2.5:3b") and not setup_ai.has_model(None, "x:1")


def test_cloud_key_means_no_big_download(tmp_path):
    env_file = tmp_path / ".env"
    assert not setup_ai.cloud_key_configured({}, str(env_file))
    assert setup_ai.cloud_key_configured({"ANTHROPIC_API_KEY": "sk-x"}, str(env_file))
    env_file.write_text("# ANTHROPIC_API_KEY=\nANTHROPIC_API_KEY=\n")
    assert not setup_ai.cloud_key_configured({}, str(env_file))
    env_file.write_text('OPENAI_API_KEY="sk-real"\n')
    assert setup_ai.cloud_key_configured({}, str(env_file))


SIZES = {"mistral:7b": 4_100_000_000, "qwen2.5:3b": 1_900_000_000, "llama3.2:1b": 1_300_000_000, "qwen2.5:1.5b": 1_000_000_000}


@pytest.fixture
def fake(monkeypatch):
    state = {"installed": False, "running": False, "models": [], "pulled": [], "log": []}
    monkeypatch.setattr(setup_ai, "cloud_key_configured", lambda *a, **k: False)
    monkeypatch.setattr(setup_ai, "total_ram_gb", lambda: 6.0)
    monkeypatch.setattr(setup_ai, "say", lambda msg="": state["log"].append(msg))
    monkeypatch.setattr(setup_ai, "find_ollama", lambda: "ollama.exe" if state["installed"] else None)
    monkeypatch.setattr(setup_ai, "installed_info", lambda: [(m, SIZES.get(m, 1_000_000_000)) for m in state["models"]] if state["running"] else None)
    def install():
        state["installed"] = True; return True
    def start(exe):
        state["running"] = True
    def pull(exe, model):
        state["pulled"].append(model); state["models"].append(model); return True
    monkeypatch.setattr(setup_ai, "install_ollama", install)
    monkeypatch.setattr(setup_ai, "start_server", start)
    monkeypatch.setattr(setup_ai, "wait_for_server", lambda s: state["running"])
    monkeypatch.setattr(setup_ai, "pull", pull)
    monkeypatch.setattr(setup_ai, "prove_it_answers", lambda model: (True, "Hello!", 2.0))
    monkeypatch.delenv("MINDSENCE_SKIP_AI", raising=False)
    return state


def test_fresh_machine_gets_everything(fake):
    assert setup_ai.main([]) == 0
    assert fake["installed"] and fake["running"] and fake["pulled"] == ["qwen2.5:1.5b"]       # 6 GB -> the 1.5B model
    assert any("READY" in m for m in fake["log"])


def test_second_run_downloads_nothing(fake):
    setup_ai.main([])
    fake["pulled"].clear()
    assert setup_ai.main([]) == 0 and fake["pulled"] == []


def test_installed_but_stopped_is_started_not_reinstalled(fake):
    fake["installed"] = True
    calls = []
    setup_ai.install_ollama = lambda: calls.append("install") or True
    assert setup_ai.main([]) == 0 and calls == [] and fake["running"]


def test_failures_are_reported_not_hidden(fake, monkeypatch):
    monkeypatch.setattr(setup_ai, "install_ollama", lambda: False)
    assert setup_ai.main([]) == 1 and any("simple mode" in m for m in fake["log"])
    fake["installed"] = True; fake["running"] = True
    monkeypatch.setattr(setup_ai, "pull", lambda exe, model: False)
    assert setup_ai.main([]) == 1
    monkeypatch.setattr(setup_ai, "pull", lambda exe, model: True)
    monkeypatch.setattr(setup_ai, "prove_it_answers", lambda model: (False, "boom", 1.0))
    assert setup_ai.main([]) == 1


def test_check_mode_changes_nothing(fake):
    assert setup_ai.main(["--check"]) == 1
    assert not fake["installed"] and not fake["running"] and fake["pulled"] == []


def test_skip_flag_and_explicit_model(fake, monkeypatch):
    monkeypatch.setenv("MINDSENCE_SKIP_AI", "1")
    assert setup_ai.main([]) == 0 and not fake["installed"]
    monkeypatch.delenv("MINDSENCE_SKIP_AI")
    assert setup_ai.main(["--model", "llama3.2:1b"]) == 0 and fake["pulled"] == ["llama3.2:1b"]


def test_a_good_downloaded_model_is_used_and_nothing_is_pulled(fake):
    fake["installed"] = True; fake["running"] = True; fake["models"] = ["llama3.2:1b", "qwen2.5:3b", "nomic-embed-text:latest"]
    assert setup_ai.main([]) == 0
    assert fake["pulled"] == [] and any("Using:         qwen2.5:3b" in m for m in fake["log"])


def test_a_downloaded_model_too_big_for_this_computer_is_not_chosen(fake, monkeypatch):
    fake["installed"] = True; fake["running"] = True; fake["models"] = ["mistral:7b"]            # 4.1 GB file on a 6 GB machine
    assert setup_ai.main([]) == 0
    assert fake["pulled"] == ["qwen2.5:1.5b"]                                                     # so a fitting one is downloaded


def test_a_big_machine_keeps_its_bigger_downloaded_model(fake, monkeypatch):
    monkeypatch.setattr(setup_ai, "total_ram_gb", lambda: 32.0)
    fake["installed"] = True; fake["running"] = True; fake["models"] = ["mistral:7b"]
    assert setup_ai.main([]) == 0 and fake["pulled"] == [] and any("mistral:7b" in m for m in fake["log"])


def test_embedding_models_never_count(fake):
    fake["installed"] = True; fake["running"] = True; fake["models"] = ["nomic-embed-text:latest"]
    assert setup_ai.main([]) == 0 and fake["pulled"] == ["qwen2.5:1.5b"]


def test_check_reports_what_it_would_do(fake):
    fake["installed"] = True; fake["running"] = True; fake["models"] = ["qwen2.5:1.5b"]
    assert setup_ai.main(["--check"]) == 0 and any("Would use:     qwen2.5:1.5b" in m for m in fake["log"])
    assert fake["pulled"] == []


def test_install_command_sets_the_execution_policy_for_this_session():
    import inspect
    src = inspect.getsource(setup_ai.install_ollama)
    assert "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass" in src and "irm https://ollama.com/install.ps1 | iex" in src
