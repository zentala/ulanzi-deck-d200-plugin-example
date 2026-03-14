"""Entry point for the Ulanzi D200 USB dashboard demo.

Parses CLI arguments, connects to the D200 via strmdck, registers
a default 4-widget layout (clock, CPU, RAM, text), and runs the
blocking dashboard loop until interrupted by SIGINT or SIGTERM.

Usage:
    ulanzi-usb-demo --fps 2
    ulanzi-usb-demo --fps 5 --verbose
"""
from __future__ import annotations

import argparse
import signal
import sys
from typing import Any

from .dashboard import Dashboard, Widget
from .icons import IconGenerator


def build_default_layout(device: Any, fps: int) -> Dashboard:
    """Construct a :class:`Dashboard` with the default 4-widget layout.

    Slots:
        0: Live clock (HH:MM on dark background)
        1: CPU usage % with color-coded background
        2: RAM usage % with color-coded background
        3: Static "DEMO" label on a purple background

    Args:
        device: Connected strmdck ``StreamDeck`` instance.
        fps: Refresh rate passed to :class:`Dashboard`.

    Returns:
        Configured :class:`Dashboard` ready to call :meth:`Dashboard.run`.
    """
    dash = Dashboard(device, fps=fps)
    gen = IconGenerator

    dash.register(0, Widget(
        render=lambda: gen.to_bytes(gen.clock_icon()),
        label="clock",
    ))
    dash.register(1, Widget(
        render=lambda: gen.to_bytes(gen.cpu_icon()),
        label="cpu",
    ))
    dash.register(2, Widget(
        render=lambda: gen.to_bytes(gen.ram_icon()),
        label="ram",
    ))
    dash.register(3, Widget(
        render=lambda: gen.to_bytes(gen.text_icon("DEMO", bg_color="#330066")),
        label="demo",
    ))
    return dash


def main() -> int:
    """CLI entry point.

    Parses arguments, connects to the D200, registers signal handlers,
    and runs the dashboard loop.

    Returns:
        Exit code: 0 on clean shutdown, 1 on connection or import error.
    """
    try:
        from strmdck import StreamDeck  # type: ignore[import]
    except ImportError:
        print(
            "ERROR: 'strmdck' package not found.\n"
            "Install it with:\n"
            "    pip install 'strmdck>=0.1.0rc1'\n"
            "Note: strmdck is pre-release – pin the version in your environment.",
            file=sys.stderr,
        )
        return 1

    parser = argparse.ArgumentParser(
        description="Ulanzi D200 USB Dashboard Demo – live clock/CPU/RAM display"
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=2,
        help="Dashboard refresh rate in frames per second (default: 2)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    args = parser.parse_args()

    if args.verbose:
        print(f"[main] Starting dashboard at {args.fps} FPS")

    print("Connecting to Ulanzi D200...")
    try:
        device = StreamDeck()
        device.connect()
    except Exception as exc:
        print(f"ERROR: Could not connect to D200: {exc}", file=sys.stderr)
        print(
            "Troubleshooting:\n"
            "  - Ensure D200 is connected via USB-C\n"
            "  - Close UlanziStudio (it holds exclusive USB access)\n"
            "  - Windows: install WinUSB driver via Zadig (https://zadig.akeo.ie/)",
            file=sys.stderr,
        )
        return 1

    if args.verbose:
        print("[main] Device connected")

    dashboard = build_default_layout(device, fps=args.fps)
    device.on_key_change(dashboard.on_key_press)

    def _shutdown(sig: int, frame: object) -> None:
        """Handle SIGINT / SIGTERM by stopping the dashboard loop."""
        print("\n[main] Shutting down...")
        dashboard.stop()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print("[main] Dashboard running. Press Ctrl+C to stop.")
    dashboard.run()

    device.disconnect()
    if args.verbose:
        print("[main] Disconnected. Goodbye.")
    return 0
