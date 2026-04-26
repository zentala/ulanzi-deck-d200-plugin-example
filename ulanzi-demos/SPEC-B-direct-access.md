# PRD + Implementation Spec: Ulanzi D200 – Approach B: Direct Access (without UlanziStudio)

```
Document: SPEC-B-direct-access.md
Status: READY FOR IMPLEMENTATION
Version: 1.0.0
Date: 2026-03-14
Target repo: ulanzi-demos/usb/demo/ and ulanzi-demos/shell/demo/
```

---

## Table of Contents

1. [D200 Hardware Context](#1-d200-hardware-context)
2. [B1: Python USB (strmdck) – `/usb/demo/`](#2-b1-python-usb-strmdck)
3. [B2: ADB Root Shell (framebuffer) – `/shell/demo/`](#3-b2-adb-root-shell-framebuffer)
4. [B1 vs B2 Comparison](#4-b1-vs-b2-comparison)
5. [DDD – Glossary of Terms](#5-ddd--glossary-of-terms)

---

## 1. D200 Hardware Context

| Parameter | Value |
|---|---|
| CPU | Rockchip RK3308HS, quad-core ARM Cortex-A35 |
| OS | Linux 5.10.160, AOSP kernel, Buildroot userspace |
| ISA Architecture | ARMv7 (32-bit, hard-float) |
| Buttons | 13 programmable LCD keys |
| PC Connection | USB-C (HID/vendor protocol) |
| ADB | **Open root shell – factory default!** |
| Framebuffer | `/dev/fb0` – direct pixel write |
| USB Protocol | Unencrypted, reverse-engineered (Wireshark) |

**Key Discovery** (Lucas Teske / Hackaday 2025):
D200 ships with open ADB root shell. Extremely rare in commercial devices.
Enables full control without exploits.

---

## 2. B1: Python USB (strmdck)

### 2.1 Goal and Scope

**What demo shows:**
- Control D200 from Python via USB, without UlanziStudio
- Display dynamic icons (time, CPU, RAM) on buttons
- Respond to key presses via callback
- Living dashboard – several buttons with live data

**What it proves:**
- Ability to build applications on D200 in pure Python
- Independence from official Ulanzi software

**OUT OF SCOPE:** system daemon, multi-device, firmware modification

---

### 2.2 System Requirements

| Component | Requirement |
|---|---|
| Device | Ulanzi D200 connected via USB-C |
| Host OS | Windows 10/11, macOS 10.13+, Linux kernel 4.x+ |
| Python | 3.9+ |
| USB Driver (Windows) | WinUSB/libusb-win32 via Zadig (if no UlanziStudio) |
| USB Driver (Linux) | hidraw or libusb (out-of-the-box) |
| USB Driver (macOS) | IOHIDFamily (built-in) |

> **WARNING Windows:** Without UlanziStudio, no HID driver for D200.
> Download [Zadig](https://zadig.akeo.ie/) → select Ulanzi D200 → Install WinUSB.

---

### 2.3 File Structure

```
ulanzi-demos/
└── usb/
    └── demo/
        ├── README.md
        ├── pyproject.toml
        ├── src/
        │   └── demo/
        │       ├── __init__.py       # Export: Dashboard, IconGenerator, VERSION
        │       ├── main.py           # Entry point: args, connect, run Dashboard
        │       ├── dashboard.py      # Widget loop: Map<key_index, Widget>, update_all()
        │       └── icons.py          # PIL rendering: clock, cpu, ram, text_icon
        └── tests/
            ├── __init__.py
            ├── test_icons.py         # Unit tests for icon generation (no device)
            └── test_dashboard.py     # Unit tests for dashboard (mock device)
```

---

### 2.4 Communication Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   HOST (PC/Mac/Linux)                   │
│                                                         │
│  main.py → dashboard.py → icons.py                     │
│                │                                        │
│                ▼                                        │
│           strmdck (Python USB lib)                      │
│                │  PIL Image → bytes                     │
└────────────────┼────────────────────────────────────────┘
                 │ USB-C (HID vendor protocol)
                 ▼
         ┌───────────────────────┐
         │    Ulanzi D200        │
         │  K0(time) K1(CPU)     │
         │  K2(RAM)  K3(msg)     │
         │  ... (13 buttons)     │
         └───────────────────────┘

Keypress flow:
  D200 → USB interrupt → strmdck callback →
  dashboard.on_key_press(key_idx, state)
```

---

### 2.5 Key Code Snippets

#### `src/demo/icons.py`

```python
"""Icon generation utilities for Ulanzi D200 USB demo.

All icons are PIL Images sized 72x72 px (native D200 button size).
"""
from __future__ import annotations

import datetime
import io

import psutil
from PIL import Image, ImageDraw


BUTTON_SIZE = 72


class IconGenerator:
    """Static factory methods for generating PIL images for D200 buttons."""

    @staticmethod
    def clock_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current time (HH:MM) on dark background."""
        now = datetime.datetime.now().strftime("%H:%M")
        return IconGenerator.text_icon(now, bg_color="#16213e", text_color="#00d4ff", size=size)

    @staticmethod
    def cpu_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current CPU usage % with color-coded background."""
        usage = psutil.cpu_percent(interval=None)
        color = "#ff4444" if usage > 80 else "#ffaa00" if usage > 50 else "#44cc44"
        return IconGenerator.text_icon(f"{usage:.0f}%", bg_color=color, label="CPU", size=size)

    @staticmethod
    def ram_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current RAM usage %."""
        usage = psutil.virtual_memory().percent
        color = "#ff4444" if usage > 90 else "#2244aa"
        return IconGenerator.text_icon(f"{usage:.0f}%", bg_color=color, label="RAM", size=size)

    @staticmethod
    def text_icon(
        text: str,
        bg_color: str = "#1a1a2e",
        text_color: str = "#ffffff",
        label: str = "",
        size: int = BUTTON_SIZE,
    ) -> Image.Image:
        """Render arbitrary text centered on colored background."""
        img = Image.new("RGB", (size, size), bg_color)
        draw = ImageDraw.Draw(img)
        draw.text((size // 2, size // 2 - 8), text, fill=text_color, anchor="mm")
        if label:
            draw.text((size // 2, size - 10), label, fill="#aaaaaa", anchor="mm")
        return img

    @staticmethod
    def to_bytes(img: Image.Image) -> bytes:
        """Convert PIL Image to JPEG bytes for strmdck.set_key_image()."""
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
```

#### `src/demo/dashboard.py`

```python
"""Dashboard orchestrator mapping D200 buttons to live widgets."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable


@dataclass
class Widget:
    """Single button widget: render function + metadata."""
    render: Callable[[], bytes]  # returns bytes for strmdck.set_key_image()
    label: str = ""
    active: bool = True


class Dashboard:
    """Maps 13 D200 buttons to widgets and drives the update loop."""

    def __init__(self, device, fps: int = 2) -> None:
        self._device = device
        self._fps = fps
        self._slots: dict[int, Widget] = {}
        self._running = False

    def register(self, key_index: int, widget: Widget) -> None:
        if not 0 <= key_index <= 12:
            raise ValueError(f"key_index must be 0–12, got {key_index}")
        self._slots[key_index] = widget

    def on_key_press(self, key_index: int, pressed: bool) -> None:
        state = "pressed" if pressed else "released"
        print(f"[dashboard] key {key_index} {state}")

    def run(self) -> None:
        """Start the update loop. Blocks until stop() is called."""
        self._running = True
        interval = 1.0 / self._fps
        try:
            while self._running:
                self._update_all()
                time.sleep(interval)
        finally:
            self._clear_all()

    def stop(self) -> None:
        self._running = False

    def _update_all(self) -> None:
        for key_index, widget in self._slots.items():
            if widget.active:
                self._device.set_key_image(key_index, widget.render())

    def _clear_all(self) -> None:
        from .icons import IconGenerator
        blank = IconGenerator.to_bytes(IconGenerator.text_icon(""))
        for key_index in self._slots:
            try:
                self._device.set_key_image(key_index, blank)
            except Exception:
                pass
```

#### `src/demo/main.py`

```python
"""Entry point for Ulanzi D200 USB demo dashboard."""
from __future__ import annotations

import argparse
import signal
import sys

from strmdck import StreamDeck

from .dashboard import Dashboard, Widget
from .icons import IconGenerator


def build_default_layout(device, fps: int) -> Dashboard:
    dash = Dashboard(device, fps=fps)
    gen = IconGenerator
    dash.register(0, Widget(render=lambda: gen.to_bytes(gen.clock_icon()), label="clock"))
    dash.register(1, Widget(render=lambda: gen.to_bytes(gen.cpu_icon()), label="cpu"))
    dash.register(2, Widget(render=lambda: gen.to_bytes(gen.ram_icon()), label="ram"))
    dash.register(3, Widget(
        render=lambda: gen.to_bytes(gen.text_icon("DEMO", bg_color="#330066")),
        label="demo",
    ))
    return dash


def main() -> int:
    parser = argparse.ArgumentParser(description="Ulanzi D200 USB Dashboard Demo")
    parser.add_argument("--fps", type=int, default=2)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    print("Connecting to Ulanzi D200...")
    try:
        device = StreamDeck()
        device.connect()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    dashboard = build_default_layout(device, fps=args.fps)
    device.on_key_change(dashboard.on_key_press)

    def _shutdown(sig, frame):
        dashboard.stop()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    dashboard.run()
    device.disconnect()
    return 0
```

#### `pyproject.toml`

```toml
[project]
name = "ulanzi-usb-demo"
version = "0.1.0"
description = "Ulanzi D200 USB dashboard demo (Approach B1)"
requires-python = ">=3.9"
dependencies = [
    "strmdck>=0.1.0rc1",
    "Pillow>=10.0.0",
    "psutil>=5.9.0",
]

[project.scripts]
ulanzi-usb-demo = "demo.main:main"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "--cov=src/demo --cov-report=term-missing --cov-fail-under=80"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

---

### 2.6 Dependencies

| Package | Min. Version | Purpose |
|---|---|---|
| `strmdck` | 0.1.0rc1 | USB communication with D200 |
| `Pillow` | 10.0.0 | Icon generation |
| `psutil` | 5.9.0 | CPU%, RAM% |

---

### 2.7 How to Run

```bash
# 1. Connect D200 via USB-C
# 2. Close UlanziStudio (releases USB)

cd ulanzi-demos/usb/demo

python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

pip install -e .

# Run
ulanzi-usb-demo --fps 2

# Tests
pytest

# Windows – no driver? Download Zadig: https://zadig.akeo.ie/
# Ulanzi D200 → Install WinUSB
```

---

### 2.8 Limitations and Risks

| Risk | Probability | Mitigation |
|---|---|---|
| USB protocol changed after firmware update | Medium | Pin firmware version; monitor strmdck issues |
| `strmdck` is pre-release (RC) | High | Pin version in pyproject.toml; wrapper layer isolates API |
| Windows: no HID driver | High (first run) | Zadig documentation in README |
| Conflict with UlanziStudio over USB | High | Close UlanziStudio |
| strmdck has low activity (18 stars) | High | Read source, write own wrapper if needed |

---

### 2.9 Key Technical Decisions

**D1: PIL instead of HTML Canvas** – headless, no browser, Python standard.

**D2: Widget wrapper isolates strmdck API** – single point of change when RC → stable.

**D3: JPEG (quality=85) instead of PNG** – smaller size = faster USB transfer.

**D4: FPS=2 by default** – system metrics don't require high FPS; doesn't burden USB.

**D5: Graceful shutdown with blank icons** – on Ctrl+C screen returns to default state.

---

## 3. B2: ADB Root Shell (framebuffer)

### 3.1 Goal and Scope

**What demo shows:**
- Direct write to `/dev/fb0` on D200 via ADB
- Display custom images on full device screen
- Simple animation via Python loop (host) → ADB → framebuffer
- Ability to run code directly ON the device

**What it proves:**
- D200 = full-fledged Linux SBC with complete ADB root shell control
- Framebuffer pipeline works: PIL (host) → ADB push → `/dev/fb0`

**OUT OF SCOPE:** custom kernel, persistent daemon, interactive UI with key handling

---

### 3.2 System Requirements

| Component | Requirement |
|---|---|
| Device | Ulanzi D200 (factory firmware with open ADB) |
| Connection | USB-C to PC |
| ADB | `adb` in PATH |
| Host OS | Windows 10/11, macOS, Linux |
| Host Python | 3.9+ |

**Installing ADB:**
```bash
# Windows
winget install Google.PlatformTools

# macOS
brew install android-platform-tools

# Linux
sudo apt install adb
```

**Verification:**
```bash
adb devices
# Expected output:
# List of devices attached
# XXXXXXXX   device
```

---

### 3.3 File Structure

```
ulanzi-demos/
└── shell/
    └── demo/
        ├── README.md
        ├── push.sh                  # Deploy script: check ADB, run display.py
        ├── src/
        │   ├── display.py           # Generate PIL frames → raw bytes → /dev/fb0
        │   └── adb_helper.py        # ADB wrapper: push, shell, push_raw_to_fb, get_fb_info
        └── assets/
            └── frames/              # Generated PNG frames (optional)
```

---

### 3.4 Communication Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      HOST (PC/Mac/Linux)                    │
│                                                             │
│  display.py → FrameGenerator (PIL) → image_to_fb_bytes()   │
│       │                                                     │
│       ▼                                                     │
│  adb_helper.py                                              │
│  AdbHelper.push_raw_to_fb(raw_bytes)                        │
│  → subprocess: adb shell "dd of=/dev/fb0"                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ USB-C (ADB protocol)
                           ▼
           ┌────────────────────────────────┐
           │        Ulanzi D200             │
           │   Linux 5.10.160 / Buildroot   │
           │                                │
           │  /dev/fb0 (framebuffer)        │
           │       ↓                        │
           │  LCD Display (full screen)     │
           └────────────────────────────────┘

Alternative (program on device):
  HOST → adb push binary → /userdata/my_program
       → adb shell chmod +x /userdata/my_program
       → adb shell /userdata/my_program
         (runs locally on ARMv7, direct /dev/fb0 access)
```

---

### 3.5 Key Code Snippets

#### `src/adb_helper.py`

```python
"""ADB communication helper for Ulanzi D200 framebuffer access."""
from __future__ import annotations

import subprocess
from pathlib import Path


class AdbHelper:
    """Interface to ADB CLI for D200 framebuffer operations."""

    FB0_PATH = "/dev/fb0"

    def check_device(self) -> str:
        """Return device serial or raise RuntimeError if no device."""
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True, check=True)
        lines = [l for l in result.stdout.strip().splitlines() if "\tdevice" in l]
        if not lines:
            raise RuntimeError(
                "No ADB device found. Connect D200 via USB and run 'adb devices'."
            )
        return lines[0].split("\t")[0]

    def shell(self, cmd: str) -> subprocess.CompletedProcess:
        return subprocess.run(["adb", "shell", cmd], capture_output=True, text=True, check=True)

    def push(self, local: Path, remote: str) -> None:
        subprocess.run(["adb", "push", str(local), remote], check=True)

    def push_raw_to_fb(self, raw_bytes: bytes) -> None:
        """Write raw pixel bytes to /dev/fb0 via ADB stdin pipe.

        Uses 'adb shell dd of=/dev/fb0' with bytes piped via stdin.
        Lowest-latency method: no intermediate file on device.
        """
        subprocess.run(
            ["adb", "shell", f"dd of={self.FB0_PATH}"],
            input=raw_bytes,
            check=True,
        )

    def get_fb_info(self) -> dict[str, int]:
        """Read framebuffer geometry from /sys/class/graphics/fb0/."""
        def read_sys(attr: str) -> str:
            return self.shell(f"cat /sys/class/graphics/fb0/{attr}").stdout.strip()

        size_str = read_sys("virtual_size")  # e.g. "480,272"
        w, h = (int(x) for x in size_str.split(","))
        bpp = int(read_sys("bits_per_pixel"))   # 16 (RGB565) or 32 (RGBA8888)
        stride = int(read_sys("stride"))

        return {"width": w, "height": h, "bits_per_pixel": bpp, "stride": stride}
```

#### `src/display.py`

```python
"""Frame generation and streaming to Ulanzi D200 framebuffer via ADB.

Modes:
  --stream   Live generation + push loop (default demo)
  --generate Save PNG frames to assets/frames/
  --play     Replay saved PNG frames

IMPORTANT: SCREEN_WIDTH/HEIGHT are PLACEHOLDERS.
Run 'adb shell cat /sys/class/graphics/fb0/virtual_size' before first run
and update constants, or let get_fb_info() detect them automatically.
"""
from __future__ import annotations

import argparse
import datetime
import math
import struct
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw

from .adb_helper import AdbHelper


# PLACEHOLDERS – verify via: adb shell cat /sys/class/graphics/fb0/virtual_size
SCREEN_WIDTH = 480
SCREEN_HEIGHT = 272


def pil_to_rgb565(img: Image.Image) -> bytes:
    """Convert PIL RGB Image to raw RGB565 LE bytes."""
    img = img.convert("RGB")
    pixels = list(img.getdata())
    result = bytearray(len(pixels) * 2)
    for i, (r, g, b) in enumerate(pixels):
        val = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
        struct.pack_into("<H", result, i * 2, val)
    return bytes(result)


def pil_to_rgba8888(img: Image.Image) -> bytes:
    """Convert PIL Image to raw RGBA8888 bytes."""
    return img.convert("RGBA").tobytes()


def image_to_fb_bytes(img: Image.Image, bpp: int) -> bytes:
    """Convert PIL image to framebuffer bytes based on bits_per_pixel."""
    img = img.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)
    if bpp == 16:
        return pil_to_rgb565(img)
    elif bpp == 32:
        return pil_to_rgba8888(img)
    raise ValueError(f"Unsupported bits_per_pixel: {bpp}")


class FrameGenerator:
    """Generate animation frames as PIL Images."""

    def clock_frame(self, w: int, h: int) -> Image.Image:
        img = Image.new("RGB", (w, h), "#0a0a1a")
        draw = ImageDraw.Draw(img)
        draw.text((w // 2, h // 2 - 20), datetime.datetime.now().strftime("%H:%M:%S"),
                  fill="#00d4ff", anchor="mm")
        draw.text((w // 2, h // 2 + 20), datetime.datetime.now().strftime("%Y-%m-%d"),
                  fill="#666666", anchor="mm")
        return img

    def pulse_frame(self, w: int, h: int, t: float) -> Image.Image:
        """Pulsing RGB color animation."""
        r = int(128 + 127 * math.sin(t * 2))
        g = int(128 + 127 * math.sin(t * 2 + 2.094))
        b = int(128 + 127 * math.sin(t * 2 + 4.189))
        img = Image.new("RGB", (w, h), (r, g, b))
        ImageDraw.Draw(img).text((w // 2, h // 2), "D200", fill="#ffffff", anchor="mm")
        return img


def stream_animation(adb: AdbHelper, fps: int = 10) -> None:
    """Continuously generate and push frames to /dev/fb0."""
    fb = adb.get_fb_info()
    print(f"[display] Framebuffer: {fb}")
    gen = FrameGenerator()
    interval = 1.0 / fps
    t = 0.0
    print(f"[display] Streaming at {fps} FPS. Ctrl+C to stop.")
    try:
        while True:
            start = time.monotonic()
            frame = gen.pulse_frame(fb["width"], fb["height"], t)
            adb.push_raw_to_fb(image_to_fb_bytes(frame, fb["bits_per_pixel"]))
            elapsed = time.monotonic() - start
            t += elapsed
            time.sleep(max(0, interval - elapsed))
    except KeyboardInterrupt:
        print("\n[display] Stopped. Clearing screen...")
        blank = Image.new("RGB", (fb["width"], fb["height"]), "#000000")
        adb.push_raw_to_fb(image_to_fb_bytes(blank, fb["bits_per_pixel"]))


def main() -> int:
    parser = argparse.ArgumentParser(description="Ulanzi D200 ADB Framebuffer Demo")
    parser.add_argument("--stream", action="store_true", default=True)
    parser.add_argument("--generate", action="store_true")
    parser.add_argument("--play", action="store_true")
    parser.add_argument("--fps", type=int, default=10)
    parser.add_argument("--frames-dir", type=Path, default=Path("assets/frames"))
    args = parser.parse_args()

    adb = AdbHelper()
    try:
        serial = adb.check_device()
        print(f"[display] Connected: {serial}")
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.generate:
        _generate_frames(args.frames_dir)
    elif args.play:
        _play_frames(adb, args.frames_dir, fps=args.fps)
    else:
        stream_animation(adb, fps=args.fps)

    return 0


def _generate_frames(output_dir: Path, count: int = 60) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    gen = FrameGenerator()
    for i in range(count):
        frame = gen.pulse_frame(SCREEN_WIDTH, SCREEN_HEIGHT, i / 10.0)
        frame.save(output_dir / f"frame_{i:03d}.png")
        print(f"[generate] {i+1}/{count}")
    print(f"[generate] Done → {output_dir}")


def _play_frames(adb: AdbHelper, frames_dir: Path, fps: int) -> None:
    fb = adb.get_fb_info()
    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        print(f"ERROR: No frame_*.png in {frames_dir}", file=sys.stderr)
        sys.exit(1)
    interval = 1.0 / fps
    print(f"[play] {len(frames)} frames at {fps} FPS. Ctrl+C to stop.")
    try:
        while True:
            for fpath in frames:
                start = time.monotonic()
                img = Image.open(fpath)
                adb.push_raw_to_fb(image_to_fb_bytes(img, fb["bits_per_pixel"]))
                time.sleep(max(0, interval - (time.monotonic() - start)))
    except KeyboardInterrupt:
        print("\n[play] Stopped.")
```

#### `push.sh`

```bash
#!/usr/bin/env bash
# push.sh – Deploy and run ADB framebuffer demo on Ulanzi D200
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FPS="${1:-10}"

echo "[push.sh] Checking ADB device..."
if ! adb devices | grep -q "device$"; then
    echo "ERROR: No ADB device. Connect D200 via USB."
    exit 1
fi

echo "[push.sh] Framebuffer info:"
adb shell "cat /sys/class/graphics/fb0/virtual_size \
           /sys/class/graphics/fb0/bits_per_pixel \
           /sys/class/graphics/fb0/stride" || true

cd "${SCRIPT_DIR}"
python src/display.py --stream --fps "${FPS}"
```

---

### 3.6 Dependencies

**Python (host):**

| Package | Min. Version | Purpose |
|---|---|---|
| `Pillow` | 10.0.0 | Image generation and scaling |
| `psutil` | 5.9.0 | Optional: system metrics |

**System tools:**

| Tool | Purpose |
|---|---|
| `adb` | Android Debug Bridge – USB communication |
| Python 3.9+ | Run display.py |

**On device:** nothing to install. Busybox `sh`, `cat`, `dd` available out-of-the-box.

---

### 3.7 How to Run

```bash
# 1. Install ADB:
#    Windows: winget install Google.PlatformTools
#    macOS:   brew install android-platform-tools
#    Linux:   sudo apt install adb

# 2. Connect D200 via USB-C

# 3. Verify
adb devices
# Expected output: XXXXXXXX   device

# 4. IMPORTANT: check framebuffer format
adb shell cat /sys/class/graphics/fb0/virtual_size
adb shell cat /sys/class/graphics/fb0/bits_per_pixel
# Update SCREEN_WIDTH/HEIGHT in display.py!

# 5. Install dependencies
cd ulanzi-demos/shell/demo
python -m venv .venv
source .venv/bin/activate
pip install Pillow psutil

# 6. Live stream (pulsing animation)
./push.sh 10
# or
python src/display.py --stream --fps 10

# 7. Generate and play frames
python src/display.py --generate
python src/display.py --play --fps 30

# --- DIAGNOSTICS ---
# Check if fb0 is writable:
adb shell "ls -la /dev/fb0"

# Manual test – black screen:
adb shell "dd if=/dev/zero of=/dev/fb0 bs=1024 count=1000"

# Test – noise (screen = random pixels):
adb shell "cat /dev/urandom | dd of=/dev/fb0 bs=1024 count=200"
```

---

### 3.8 Limitations and Risks

| Risk | Probability | Mitigation |
|---|---|---|
| ADB disabled in future firmware | Low-Medium | Don't update firmware without checking changelog |
| Unknown `/dev/fb0` pixel format | High | `get_fb_info()` auto-detect from `/sys/` |
| Unknown resolution (PLACEHOLDER!) | High | Always read `virtual_size` before first push |
| Low ADB performance (5-15ms latency per frame) | High | Max ~10-15 FPS via ADB; for 30fps use ARM binary |
| Conflict with UlanziStudio using FB | High | Stop/close UlanziStudio before test |
| Write outside resolution → crash | Medium | Always verify size via `get_fb_info()` |

**Known FPS Limitations:**
- ADB overhead: 5-15ms per frame = max ~10-20 FPS practically
- For 30fps: own ARM binary (like `rlaneth/badustudio` in C++)

---

### 3.9 Key Technical Decisions

**D1: Host-side rendering (PIL on PC), not ARM binary.**
Demo = concept. ARM cross-compilation is additional toolchain. For prod: move to binary.

**D2: `dd of=/dev/fb0` via `adb shell` with piped stdin.**
Lowest latency – no intermediate file. Requires exactly `bpp * w * h` bytes.

**D3: Format auto-detection via `/sys/class/graphics/fb0/`.**
Don't hardcode RGB565 – device may use RGBA8888. `get_fb_info()` reads real values.

**D4: SCREEN_WIDTH/HEIGHT as PLACEHOLDER requiring verification.**
Exact values unknown from documentation. `get_fb_info()` automatically fetches them.

**D5: `--stream` as main demo mode.**
Live generation shows dynamism. `--play` for high FPS with pre-cached frames.

---

## 4. B1 vs B2 Comparison

| Criterion | B1 (Python USB / strmdck) | B2 (ADB Framebuffer) |
|---|---|---|
| Connection | USB HID vendor protocol | ADB (USB Debug Bridge) |
| What you control | Per-button (72x72px each) | Full screen at once |
| Requirements | Python + strmdck | Python + `adb` in PATH |
| Windows setup | Zadig for driver | SDK Platform Tools |
| Max FPS | ~30fps | ~10-15fps (ADB); 30fps w/ ARM binary |
| Key handling | YES (native callback) | NO (requires separate mechanism) |
| Difficulty | Medium | Medium setup / High (ARM binary) |
| API stability | Low (strmdck RC, community) | High (ADB + FB = Linux standard) |
| Firmware risk | High (USB proto may change) | Low-Medium (ADB may disable) |
| "Wow factor" | Dashboard w/ live per-key data | Full-screen animation / DOOM |

**Recommendation:**
- Start with **B2** (ADB) – simpler setup, no strmdck RC, ADB = standard
- Add **B1** when strmdck reaches stable release

---

## 5. DDD – Glossary of Terms

| Term | Definition |
|---|---|
| **D200** | Ulanzi Stream Controller D200 – device with 13 programmable LCD buttons |
| **Framebuffer** | `/dev/fb0` – Linux device file = screen memory; write → display |
| **ADB** | Android Debug Bridge – CLI for device communication via USB |
| **Buildroot** | Embedded Linux system used as D200 userspace |
| **RGB565** | Pixel format: 16 bits (R=5b, G=6b, B=5b) |
| **RGBA8888** | Pixel format: 32 bits (R=8b, G=8b, B=8b, A=8b) |
| **strmdck** | Community Python library (redphx) to control D200 via USB without UlanziStudio |
| **UlanziStudio** | Official Ulanzi PC application – required for Approach A, not needed for B |
| **ARMv7** | ISA architecture of D200 CPU (hard-float, 32-bit) |
| **badustudio** | Project by rlaneth – Bad Apple 30fps on D200 via ADB + C++ player |
| **Widget** | Abstraction in B1: render function + metadata for single button |
| **DD** | Unix `dd` – used to pipe bytes to `/dev/fb0` via ADB shell |
| **HID** | Human Interface Device – USB class used by D200 |
