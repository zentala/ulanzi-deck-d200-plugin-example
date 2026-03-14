"""Unit tests for main.py entry point.

All tests mock strmdck and device interactions – no physical hardware required.
"""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest

from demo.main import build_default_layout
from demo.dashboard import Dashboard


# ---------------------------------------------------------------------------
# build_default_layout
# ---------------------------------------------------------------------------

class TestBuildDefaultLayout:
    """Tests for build_default_layout()."""

    def test_returns_dashboard_instance(self) -> None:
        dash = build_default_layout(MagicMock(), fps=2)
        assert isinstance(dash, Dashboard)

    def test_registers_four_slots(self) -> None:
        dash = build_default_layout(MagicMock(), fps=2)
        assert set(dash._slots.keys()) == {0, 1, 2, 3}

    def test_all_widgets_active(self) -> None:
        dash = build_default_layout(MagicMock(), fps=2)
        for widget in dash._slots.values():
            assert widget.active is True

    def test_widget_labels(self) -> None:
        dash = build_default_layout(MagicMock(), fps=2)
        assert dash._slots[0].label == "clock"
        assert dash._slots[1].label == "cpu"
        assert dash._slots[2].label == "ram"
        assert dash._slots[3].label == "demo"

    def test_renders_return_bytes(self) -> None:
        """Each widget's render() must return non-empty bytes."""
        with patch("psutil.cpu_percent", return_value=42.0), \
             patch("psutil.virtual_memory", return_value=MagicMock(percent=55.0)):
            dash = build_default_layout(MagicMock(), fps=2)
            for idx, widget in dash._slots.items():
                result = widget.render()
                assert isinstance(result, bytes), f"slot {idx} render() returned non-bytes"
                assert len(result) > 0, f"slot {idx} render() returned empty bytes"

    def test_fps_passed_to_dashboard(self) -> None:
        dash = build_default_layout(MagicMock(), fps=5)
        assert dash._fps == 5


# ---------------------------------------------------------------------------
# main() – strmdck import failure
# ---------------------------------------------------------------------------

class TestMainImportError:
    """Tests for main() when strmdck is not installed."""

    def test_returns_1_when_strmdck_missing(self, capsys: pytest.CaptureFixture) -> None:
        """main() must return 1 and print a helpful error if strmdck is absent."""
        with patch.dict(sys.modules, {"strmdck": None}):
            from demo import main as main_mod
            import importlib
            importlib.reload(main_mod)
            result = main_mod.main()
        assert result == 1
        captured = capsys.readouterr()
        assert "strmdck" in captured.err


# ---------------------------------------------------------------------------
# main() – device connection failure
# ---------------------------------------------------------------------------

class TestMainConnectionError:
    """Tests for main() when StreamDeck.connect() raises."""

    def test_returns_1_on_connect_error(self, capsys: pytest.CaptureFixture) -> None:
        """main() must return 1 and print troubleshooting info if connect() fails."""
        mock_deck_cls = MagicMock()
        mock_deck_cls.return_value.connect.side_effect = OSError("device not found")

        with patch.dict(sys.modules, {"strmdck": MagicMock(StreamDeck=mock_deck_cls)}), \
             patch("sys.argv", ["ulanzi-usb-demo"]):
            from demo import main as main_mod
            import importlib
            importlib.reload(main_mod)
            result = main_mod.main()

        assert result == 1
        captured = capsys.readouterr()
        assert "ERROR" in captured.err


# ---------------------------------------------------------------------------
# main() – happy path
# ---------------------------------------------------------------------------

class TestMainHappyPath:
    """Tests for main() successful run."""

    def test_returns_0_on_clean_run(self) -> None:
        """main() must return 0 when dashboard stops cleanly."""
        mock_deck_instance = MagicMock()

        # Make dashboard.run() stop immediately via on_key_change side effect
        def fake_run(dashboard_instance=None):
            pass  # instant stop – don't block

        mock_deck_cls = MagicMock(return_value=mock_deck_instance)

        with patch.dict(sys.modules, {"strmdck": MagicMock(StreamDeck=mock_deck_cls)}), \
             patch("demo.main.Dashboard.run", return_value=None), \
             patch("psutil.cpu_percent", return_value=10.0), \
             patch("psutil.virtual_memory", return_value=MagicMock(percent=30.0)), \
             patch("sys.argv", ["ulanzi-usb-demo"]):
            from demo import main as main_mod
            import importlib
            importlib.reload(main_mod)
            result = main_mod.main()

        assert result == 0
        mock_deck_instance.connect.assert_called_once()
        mock_deck_instance.disconnect.assert_called_once()
