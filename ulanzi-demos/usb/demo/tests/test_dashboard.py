"""Unit tests for Dashboard with a mock device.

No physical hardware is required – all device interactions are handled
through a ``unittest.mock.MagicMock`` that records calls to
``set_key_image()``.
"""
from __future__ import annotations

import threading
from unittest.mock import MagicMock, call, patch

import pytest
from unittest.mock import ANY

from demo.dashboard import Dashboard, Widget


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_device() -> MagicMock:
    """Return a fresh MagicMock standing in for a strmdck StreamDeck."""
    return MagicMock()


@pytest.fixture()
def dashboard(mock_device: MagicMock) -> Dashboard:
    """Return a Dashboard wired to the mock device at 2 FPS."""
    return Dashboard(mock_device, fps=2)


def _noop_render() -> bytes:
    """Minimal render function returning a tiny valid JPEG placeholder."""
    from io import BytesIO
    from PIL import Image
    buf = BytesIO()
    Image.new("RGB", (8, 8), "#000000").save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

class TestRegister:
    """Tests for Dashboard.register."""

    def test_register_valid_key(self, dashboard: Dashboard) -> None:
        """register() must store the widget without raising for keys 0–12."""
        widget = Widget(render=_noop_render, label="test")
        dashboard.register(0, widget)
        assert dashboard._slots[0] is widget

    def test_register_all_valid_keys(self, dashboard: Dashboard) -> None:
        """register() must accept every key index in the valid range."""
        for idx in range(13):
            dashboard.register(idx, Widget(render=_noop_render))
        assert len(dashboard._slots) == 13

    def test_register_invalid_key_raises(self, dashboard: Dashboard) -> None:
        """register() must raise ValueError for key_index outside 0–12."""
        widget = Widget(render=_noop_render)
        with pytest.raises(ValueError, match="key_index"):
            dashboard.register(13, widget)

    def test_register_negative_key_raises(self, dashboard: Dashboard) -> None:
        """register() must raise ValueError for negative key_index."""
        widget = Widget(render=_noop_render)
        with pytest.raises(ValueError, match="key_index"):
            dashboard.register(-1, widget)


# ---------------------------------------------------------------------------
# on_key_press
# ---------------------------------------------------------------------------

class TestOnKeyPress:
    """Tests for Dashboard.on_key_press."""

    def test_on_key_press_prints_pressed(
        self, dashboard: Dashboard, capsys: pytest.CaptureFixture
    ) -> None:
        """on_key_press(0, True) must print 'key 0 pressed'."""
        dashboard.on_key_press(0, True)
        captured = capsys.readouterr()
        assert "key 0" in captured.out
        assert "pressed" in captured.out

    def test_on_key_press_prints_released(
        self, dashboard: Dashboard, capsys: pytest.CaptureFixture
    ) -> None:
        """on_key_press(5, False) must print 'key 5 released'."""
        dashboard.on_key_press(5, False)
        captured = capsys.readouterr()
        assert "key 5" in captured.out
        assert "released" in captured.out


# ---------------------------------------------------------------------------
# _update_all
# ---------------------------------------------------------------------------

class TestUpdateAll:
    """Tests for Dashboard._update_all."""

    def test_update_all_calls_set_key_image(
        self, dashboard: Dashboard, mock_device: MagicMock
    ) -> None:
        """_update_all() must call device.set_key_image for each active slot."""
        dashboard.register(0, Widget(render=_noop_render, label="w0"))
        dashboard.register(1, Widget(render=_noop_render, label="w1"))
        dashboard._update_all()
        assert mock_device.set_key_image.call_count == 2

    def test_update_all_skips_inactive_widget(
        self, dashboard: Dashboard, mock_device: MagicMock
    ) -> None:
        """_update_all() must skip widgets with active=False."""
        dashboard.register(0, Widget(render=_noop_render, active=True))
        dashboard.register(1, Widget(render=_noop_render, active=False))
        dashboard._update_all()
        assert mock_device.set_key_image.call_count == 1
        mock_device.set_key_image.assert_called_once_with(0, ANY)


# ---------------------------------------------------------------------------
# run / stop
# ---------------------------------------------------------------------------

class TestRun:
    """Tests for Dashboard.run and Dashboard.stop."""

    def test_run_calls_set_key_image(
        self, dashboard: Dashboard, mock_device: MagicMock
    ) -> None:
        """run() must invoke set_key_image at least once before being stopped."""
        call_count: list[int] = [0]

        def counting_render() -> bytes:
            call_count[0] += 1
            dashboard.stop()  # stop after first render
            return _noop_render()

        dashboard.register(0, Widget(render=counting_render))
        dashboard.run()

        assert call_count[0] >= 1
        assert mock_device.set_key_image.called

    def test_stop_sets_running_false(self, dashboard: Dashboard) -> None:
        """stop() must set _running to False."""
        dashboard._running = True
        dashboard.stop()
        assert dashboard._running is False


# ---------------------------------------------------------------------------
# _clear_all
# ---------------------------------------------------------------------------

class TestClearAll:
    """Tests for Dashboard._clear_all."""

    def test_clear_all_sends_blank_to_all_registered_slots(
        self, dashboard: Dashboard, mock_device: MagicMock
    ) -> None:
        """_clear_all() must call set_key_image for every registered slot."""
        dashboard.register(0, Widget(render=_noop_render))
        dashboard.register(2, Widget(render=_noop_render))
        mock_device.set_key_image.reset_mock()
        dashboard._clear_all()
        assert mock_device.set_key_image.call_count == 2
        called_keys = {c.args[0] for c in mock_device.set_key_image.call_args_list}
        assert called_keys == {0, 2}

    def test_clear_all_on_shutdown_via_run(
        self, dashboard: Dashboard, mock_device: MagicMock
    ) -> None:
        """_clear_all() must be called (via finally) when run() exits."""
        rendered: list[bool] = []

        def stop_after_first() -> bytes:
            if not rendered:
                rendered.append(True)
                dashboard.stop()
            return _noop_render()

        dashboard.register(3, Widget(render=stop_after_first))
        mock_device.set_key_image.reset_mock()
        dashboard.run()

        # After run() returns, set_key_image must have been called at least
        # once for the update AND once for the blank (clear_all).
        assert mock_device.set_key_image.call_count >= 2

    def test_clear_all_tolerates_device_error(
        self, mock_device: MagicMock
    ) -> None:
        """_clear_all() must not propagate exceptions from set_key_image."""
        mock_device.set_key_image.side_effect = OSError("USB gone")
        dash = Dashboard(mock_device, fps=2)
        dash.register(0, Widget(render=_noop_render))
        # Should not raise
        dash._clear_all()
