"""Dashboard orchestrator mapping D200 buttons to live widgets.

The :class:`Dashboard` drives an update loop at a configurable FPS,
calling each registered :class:`Widget`'s render function and pushing
the resulting JPEG bytes to the device via ``set_key_image()``.

On shutdown (Ctrl-C / :meth:`Dashboard.stop`) a blank icon is sent to
every registered slot so the device returns to a clean visual state.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class Widget:
    """A single D200 button widget.

    Attributes:
        render: Callable that produces JPEG bytes for ``set_key_image()``.
            Called once per update cycle (at configured FPS).
        label: Human-readable identifier used for logging/debugging.
        active: When ``False`` the widget is skipped during ``_update_all``.
    """

    render: Callable[[], bytes]
    label: str = ""
    active: bool = True


class Dashboard:
    """Maps up to 13 D200 buttons to widgets and drives the update loop.

    Args:
        device: A strmdck ``StreamDeck`` instance (or compatible mock).
        fps: Target refresh rate in frames per second. Defaults to 2.
    """

    MAX_KEY_INDEX = 12

    def __init__(self, device: object, fps: int = 2) -> None:
        """Initialize the dashboard with a device handle and refresh rate."""
        self._device = device
        self._fps = fps
        self._slots: dict[int, Widget] = {}
        self._running: bool = False

    def register(self, key_index: int, widget: Widget) -> None:
        """Bind a widget to a D200 button slot.

        Args:
            key_index: Button index in the range 0–12 (inclusive).
            widget: Widget instance to render at this slot.

        Raises:
            ValueError: If ``key_index`` is outside the valid range.
        """
        if not 0 <= key_index <= self.MAX_KEY_INDEX:
            raise ValueError(
                f"key_index must be 0–{self.MAX_KEY_INDEX}, got {key_index}"
            )
        self._slots[key_index] = widget

    def on_key_press(self, key_index: int, pressed: bool) -> None:
        """Callback invoked by strmdck when a D200 button changes state.

        Prints a human-readable event line to stdout.  Override or wrap
        this method to add custom key-press logic.

        Args:
            key_index: Index of the button that changed state.
            pressed: ``True`` if the button was pressed, ``False`` if released.
        """
        state = "pressed" if pressed else "released"
        print(f"[dashboard] key {key_index} {state}")

    def run(self) -> None:
        """Start the blocking update loop.

        Iterates at :attr:`_fps` rate, calling :meth:`_update_all` each
        cycle.  Blocks until :meth:`stop` is called (e.g. from a signal
        handler).  Always calls :meth:`_clear_all` on exit to blank the
        device screen.
        """
        self._running = True
        interval = 1.0 / self._fps
        try:
            while self._running:
                self._update_all()
                time.sleep(interval)
        finally:
            self._clear_all()

    def stop(self) -> None:
        """Signal the update loop to exit after the current iteration."""
        self._running = False

    def _update_all(self) -> None:
        """Push rendered images for all active widgets to the device."""
        for key_index, widget in self._slots.items():
            if widget.active:
                self._device.set_key_image(key_index, widget.render())  # type: ignore[attr-defined]

    def _clear_all(self) -> None:
        """Send a blank (black) JPEG to every registered slot.

        Errors from individual slots are silently suppressed so that a
        partially connected device does not prevent cleanup of the rest.
        """
        from .icons import IconGenerator  # local import to avoid circular

        blank = IconGenerator.to_bytes(IconGenerator.text_icon(""))
        for key_index in self._slots:
            try:
                self._device.set_key_image(key_index, blank)  # type: ignore[attr-defined]
            except Exception:
                pass
