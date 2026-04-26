# ulanzi-deck-d200-plugin-example

[![CI](https://github.com/zentala/ulanzi-deck-d200-plugin-example/actions/workflows/ci.yml/badge.svg)](https://github.com/zentala/ulanzi-deck-d200-plugin-example/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Three working examples of how to control the **Ulanzi Deck D200** smart key display, plus a complete research write-up of the device.

> **Just want to get started?** Most users want **Approach A — Plugin SDK** (skip to [its README](ulanzi-demos/plugins/demo/io.zentala.ulanzideck.demo.ulanziPlugin/README.md)). Approach B is for users who want to skip UlanziStudio.

> **Disclaimer**: this is a personal, unofficial example repo. Not affiliated with or endorsed by Ulanzi. The official SDK lives at [UlanziTechnology](https://github.com/UlanziTechnology) and is included here as git submodules.

## What's the D200?

A USB-connected stream-deck-style controller with 6 LCD buttons (72×72 px each) and a main 480×272 LCD. It runs a Linux Buildroot userspace on a Rockchip RK3308HS SoC. Three independent ways exist to drive it — this repo demonstrates all three.

## Three approaches

| | **A. Plugin SDK** | **B1. USB / strmdck** | **B2. ADB framebuffer** |
|---|---|---|---|
| Official app required | ✅ UlanziStudio | ❌ | ❌ |
| Language | Node.js / browser JS | Python | Python + ADB shell |
| Driver | UlanziStudio handles USB | libusb (Zadig on Windows) | ADB |
| Granularity | Per-button actions | Per-button images | Whole-screen framebuffer |
| Native FPS | Real-time | ~2–10 fps | ~10–15 fps |
| Use when | You want plugin-style buttons integrated into Ulanzi's UI | You want to drive the buttons without installing UlanziStudio | You want full pixel control over the main LCD |
| Demo location | [`ulanzi-demos/plugins/demo/`](ulanzi-demos/plugins/demo/) | [`ulanzi-demos/usb/demo/`](ulanzi-demos/usb/demo/) | [`ulanzi-demos/shell/demo/`](ulanzi-demos/shell/demo/) |
| Spec | [`SPEC-A-plugin-sdk.md`](ulanzi-demos/SPEC-A-plugin-sdk.md) | [`SPEC-B-direct-access.md`](ulanzi-demos/SPEC-B-direct-access.md) | [`SPEC-B-direct-access.md`](ulanzi-demos/SPEC-B-direct-access.md) |

For the deep dive on architecture, hardware internals, and full SDK API surface see [`docs/ULANZI-SDK-RESEARCH.md`](docs/ULANZI-SDK-RESEARCH.md).

## Approach A — Plugin SDK demo (5 actions)

A reference plugin demonstrating canvas rendering, settings persistence, lifecycle events, and Property Inspector wiring across five independent actions:

| Action | What it does |
|---|---|
| **Clock** | Digital HH:MM clock with animated seconds-progress border. Tap toggles Warsaw ↔ Jakarta timezone. |
| **Counter** | Tap-to-count with configurable step, direction, and colors. Settings persist. |
| **CPU Status** | CPU load + temperature monitor with EMA smoothing. Reads [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) HTTP API; falls back to a Web Worker timing benchmark. Configurable overheat threshold + alert. |
| **Calendar** | Torn-off calendar — day, month name, year, day-of-week. Refreshes at midnight. |
| **Pomodoro** | Work/break timer state machine. Configurable durations; auto-pauses when the view is hidden. |

Stack: plain JS (no module system, browser-style globals), Jest tests in a `vm` sandbox, ESLint + Prettier + Husky pre-commit. UUIDs centralised in [`plugin/uuids.js`](ulanzi-demos/plugins/demo/io.zentala.ulanzideck.demo.ulanziPlugin/plugin/uuids.js). 89 unit + dispatcher tests.

See [the plugin's own README](ulanzi-demos/plugins/demo/io.zentala.ulanzideck.demo.ulanziPlugin/README.md) for installation (symlink instructions per OS).

## Approach B1 — Python USB dashboard

Live dashboard rendered onto 4 physical D200 buttons, no UlanziStudio:

- Slot 0: clock HH:MM
- Slot 1: CPU% (color-coded green/yellow/red by threshold)
- Slot 2: RAM% (same color scheme)
- Slot 3: static "DEMO" label

Stack: Python 3.9+, [redphx/strmdck](https://github.com/redphx/strmdck) for USB transport, Pillow for image rendering, psutil for system metrics. Hatchling build, pytest with 80% coverage gate. Windows users need to install the WinUSB driver via Zadig (instructions in the demo README).

See [the demo's README](ulanzi-demos/usb/demo/README.md) for setup and `--fps` tuning.

## Approach B2 — ADB framebuffer

Writes raw pixels straight to `/dev/fb0` over `adb shell dd`. Three modes:
- `--stream` — real-time pulse animation
- `--generate` — pre-render N PNG frames to disk
- `--play` — push pre-rendered frames to the device

Auto-detects framebuffer geometry from `/sys/class/graphics/fb0/{virtual_size,bits_per_pixel,stride}`, supports both RGB565 and RGBA8888 with a numpy fast-path. Practical limit ~10–15 fps over USB 2.0 + ADB protocol overhead.

> **Note**: relies on the open ADB root shell that ships on the D200 by default. Future firmware updates may close it.

See [the demo's README](ulanzi-demos/shell/demo/README.md) for ADB setup and diagnostics.

## Quick start

```bash
git clone --recurse-submodules git@github.com:zentala/ulanzi-deck-d200-plugin-example.git
cd ulanzi-deck-d200-plugin-example

# Approach A — Plugin SDK
cd ulanzi-demos/plugins/demo/io.zentala.ulanzideck.demo.ulanziPlugin
pnpm install
pnpm test

# Approach B1 — USB dashboard
cd ../../../usb/demo
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\Activate.ps1 on Windows
pip install -e . && pip install pytest pytest-cov
pytest

# Approach B2 — ADB framebuffer
cd ../../shell/demo
pip install -r requirements.txt
./push.sh 10
```

If you forgot `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Hardware requirements

- **Ulanzi Deck D200** smart key display (480×272 LCD + 6 LCD buttons)
- USB-C cable
- For Approach A: Windows 10+ or macOS 10.11+ with UlanziStudio 6.1+ installed
- For Approach B1: any OS with libusb access; Windows needs Zadig once
- For Approach B2: any OS with `adb` installed

## Status

| Demo | Tests | Build | Linting |
|---|---|---|---|
| Plugin SDK | 89 Jest tests, dispatcher + 5 actions | n/a | ESLint + Prettier + Husky |
| USB | pytest with 80% coverage gate | hatchling | ruff |
| ADB | manual smoke (`push.sh`) | n/a | n/a |

All three demos verified running on a real D200.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Issue reports for setup friction or unclear docs especially appreciated.

## License

[MIT](LICENSE) — use freely, keep the copyright notice.

The bundled SDK submodules under `libs/` are licensed by [UlanziTechnology](https://github.com/UlanziTechnology) under their own terms (AGPL 3.0 at last check — verify in the upstream repos).
