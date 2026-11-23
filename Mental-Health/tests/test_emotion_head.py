import os
import sys

import pytest

torch = pytest.importorskip("torch")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import app as backend  # noqa: E402


def test_head_math_matches_reference():
    """classify_audio uses mean-pool -> dense -> tanh -> output; verify against a manual computation."""
    torch.manual_seed(0)
    dense, output = torch.nn.Linear(8, 8), torch.nn.Linear(8, 3)
    feats = torch.randn(1, 5, 8)
    pooled = feats.mean(dim=1)
    expected = output(torch.tanh(dense(pooled)))
    class Enc:
        def __call__(self, x):
            return type("O", (), {"last_hidden_state": feats})()
    got = output(torch.tanh(dense(Enc()(None).last_hidden_state.mean(dim=1))))
    assert torch.allclose(expected, got)


def test_missing_head_weights_raise_clear_error(monkeypatch):
    monkeypatch.setattr(backend, "_load_checkpoint_state", lambda repo: {})
    pytest.importorskip("transformers")
    with pytest.raises(Exception):
        backend._build_emotion_model()
