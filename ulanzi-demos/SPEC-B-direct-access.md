# PRD + Spec Implementacyjny: Ulanzi D200 – Podejście B: Bezpośredni dostęp (bez UlanziStudio)

```
Document: SPEC-B-direct-access.md
Status: READY FOR IMPLEMENTATION
Version: 1.0.0
Date: 2026-03-14
Target repo: ulanzi-demos/usb/demo/ i ulanzi-demos/shell/demo/
```

---

## Spis treści

1. [Kontekst sprzętowy D200](#1-kontekst-sprzętowy-d200)
2. [B1: Python USB (strmdck) – `/usb/demo/`](#2-b1-python-usb-strmdck)
3. [B2: ADB Root Shell (framebuffer) – `/shell/demo/`](#3-b2-adb-root-shell-framebuffer)
4. [Porównanie B1 vs B2](#4-porównanie-b1-vs-b2)
5. [DDD – Słownik pojęć](#5-ddd--słownik-pojęć)

---

## 1. Kontekst sprzętowy D200

| Parametr | Wartość |
|---|---|
| CPU | Rockchip RK3308HS, quad-core ARM Cortex-A35 |
| OS | Linux 5.10.160, kernel z AOSP, userspace Buildroot |
| Architektura ISA | ARMv7 (32-bit, hard-float) |
| Przyciski | 13 klawiszy programowalnych LCD |
| Połączenie PC | USB-C (HID/vendor protocol) |
| ADB | **Otwarty root shell – fabrycznie!** |
| Framebuffer | `/dev/fb0` – bezpośredni zapis pikselowy |
| USB protokół | Niezaszyfrowany, zreverse-engineerowany (Wireshark) |

**Kluczowe odkrycie** (Lucas Teske / Hackaday 2025):
D200 shipi z otwartym ADB root shellem. Bardzo rzadkie w urządzeniach komercyjnych.
Umożliwia pełną kontrolę bez exploitów.

---

## 2. B1: Python USB (strmdck)

### 2.1 Cel i zakres

**Co demo pokazuje:**
- Kontrolę D200 z Pythona przez USB, bez UlanziStudio
- Wyświetlanie dynamicznych ikon (czas, CPU, RAM) na przyciskach
- Reagowanie na wciśnięcia klawiszy przez callback
- Living dashboard – kilka przycisków z live data

**Co udowadnia:**
- Możliwość budowania aplikacji na D200 w czystym Pythonie
- Niezależność od oficjalnego oprogramowania Ulanzi

**OUT OF SCOPE:** daemon systemowy, multi-device, modyfikacja firmware

---

### 2.2 Wymagania systemowe

| Komponent | Wymaganie |
|---|---|
| Urządzenie | Ulanzi D200 podłączony USB-C |
| OS hosta | Windows 10/11, macOS 10.13+, Linux kernel 4.x+ |
| Python | 3.9+ |
| USB sterownik (Windows) | WinUSB/libusb-win32 przez Zadig (jeśli brak UlanziStudio) |
| USB sterownik (Linux) | hidraw lub libusb (out-of-the-box) |
| USB sterownik (macOS) | IOHIDFamily (wbudowany) |

> **UWAGA Windows:** Bez UlanziStudio brak sterownika HID dla D200.
> Pobierz [Zadig](https://zadig.akeo.ie/) → wybierz Ulanzi D200 → Install WinUSB.

---

### 2.3 Struktura plików

```
ulanzi-demos/
└── usb/
    └── demo/
        ├── README.md
        ├── pyproject.toml
        ├── src/
        │   └── demo/
        │       ├── __init__.py       # Eksport: Dashboard, IconGenerator, VERSION
        │       ├── main.py           # Entry point: args, connect, uruchom Dashboard
        │       ├── dashboard.py      # Widget loop: Map<key_index, Widget>, update_all()
        │       └── icons.py          # PIL rendering: clock, cpu, ram, text_icon
        └── tests/
            ├── __init__.py
            ├── test_icons.py         # Unit testy generowania ikon (bez urządzenia)
            └── test_dashboard.py     # Unit testy dashboardu (mock device)
```

---

### 2.4 Diagram komunikacji

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
         │  K0(czas) K1(CPU)     │
         │  K2(RAM)  K3(msg)     │
         │  ... (13 klawiszy)    │
         └───────────────────────┘

Keypress flow:
  D200 → USB interrupt → strmdck callback →
  dashboard.on_key_press(key_idx, state)
```

---

### 2.5 Kluczowe fragmenty kodu

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

### 2.6 Zależności

| Pakiet | Min. wersja | Cel |
|---|---|---|
| `strmdck` | 0.1.0rc1 | USB komunikacja z D200 |
| `Pillow` | 10.0.0 | Generowanie ikon |
| `psutil` | 5.9.0 | CPU%, RAM% |

---

### 2.7 Jak uruchomić

```bash
# 1. Podłącz D200 przez USB-C
# 2. Zamknij UlanziStudio (zwalnia USB)

cd ulanzi-demos/usb/demo

python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

pip install -e .

# Uruchom
ulanzi-usb-demo --fps 2

# Testy
pytest

# Windows – brak sterownika? Pobierz Zadig: https://zadig.akeo.ie/
# Ulanzi D200 → Install WinUSB
```

---

### 2.8 Ograniczenia i ryzyka

| Ryzyko | Prawdopodobieństwo | Mitigation |
|---|---|---|
| Protokół USB zmieniony po firmware update | Średnie | Pinuj wersję firmware; monitoruj strmdck issues |
| `strmdck` jest pre-release (RC) | Wysokie | Pin wersja w pyproject.toml; wrapper layer izoluje API |
| Windows: brak sterownika HID | Wysokie (pierwsze uruchomienie) | Dokumentacja Zadig w README |
| Konkurencja z UlanziStudio o USB | Wysokie | Zamknij UlanziStudio |
| strmdck ma małą aktywność (18 stars) | Wysokie | Czytaj source, pisz własny wrapper jeśli trzeba |

---

### 2.9 Kluczowe decyzje techniczne

**D1: PIL zamiast HTML Canvas** – headless, bez przeglądarki, Python standard.

**D2: Widget wrapper izoluje strmdck API** – jeden punkt zmiany gdy RC → stable.

**D3: JPEG (quality=85) zamiast PNG** – mniejszy rozmiar = szybszy USB transfer.

**D4: FPS=2 domyślnie** – system metrics nie wymagają wysokiego FPS; nie obciąża USB.

**D5: Graceful shutdown z blank icons** – przy Ctrl+C ekran wraca do stanu domyślnego.

---

## 3. B2: ADB Root Shell (framebuffer)

### 3.1 Cel i zakres

**Co demo pokazuje:**
- Bezpośredni zapis do `/dev/fb0` na D200 przez ADB
- Wyświetlanie własnych obrazów na pełnym ekranie urządzenia
- Prostą animację przez pętlę Python (host) → ADB → framebuffer
- Możliwość uruchamiania kodu bezpośrednio NA urządzeniu

**Co udowadnia:**
- D200 = pełnoprawny Linux SBC z pełną kontrolą przez ADB root shell
- Framebuffer pipeline działa: PIL (host) → ADB push → `/dev/fb0`

**OUT OF SCOPE:** własny kernel, persistent daemon, interaktywne UI z obsługą klawiszy

---

### 3.2 Wymagania systemowe

| Komponent | Wymaganie |
|---|---|
| Urządzenie | Ulanzi D200 (firmware fabryczny z otwartym ADB) |
| Połączenie | USB-C do PC |
| ADB | `adb` w PATH |
| OS hosta | Windows 10/11, macOS, Linux |
| Python hosta | 3.9+ |

**Instalacja ADB:**
```bash
# Windows
winget install Google.PlatformTools

# macOS
brew install android-platform-tools

# Linux
sudo apt install adb
```

**Weryfikacja:**
```bash
adb devices
# Oczekiwany output:
# List of devices attached
# XXXXXXXX   device
```

---

### 3.3 Struktura plików

```
ulanzi-demos/
└── shell/
    └── demo/
        ├── README.md
        ├── push.sh                  # Deploy script: check ADB, run display.py
        ├── src/
        │   ├── display.py           # Generowanie ramek PIL → raw bytes → /dev/fb0
        │   └── adb_helper.py        # Wrapper ADB: push, shell, push_raw_to_fb, get_fb_info
        └── assets/
            └── frames/              # Wygenerowane ramki PNG (opcjonalne)
```

---

### 3.4 Diagram komunikacji

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
           │  LCD Display (cały ekran)      │
           └────────────────────────────────┘

Alternatywa (program na urządzeniu):
  HOST → adb push binary → /userdata/my_program
       → adb shell chmod +x /userdata/my_program
       → adb shell /userdata/my_program
         (działa lokalnie na ARMv7, bezpośredni dostęp do /dev/fb0)
```

---

### 3.5 Kluczowe fragmenty kodu

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


# PLACEHOLDERS – zweryfikuj przez: adb shell cat /sys/class/graphics/fb0/virtual_size
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

### 3.6 Zależności

**Python (host):**

| Pakiet | Min. wersja | Cel |
|---|---|---|
| `Pillow` | 10.0.0 | Generowanie i skalowanie obrazów |
| `psutil` | 5.9.0 | Opcjonalnie: metryki systemu |

**System tools:**

| Tool | Cel |
|---|---|
| `adb` | Android Debug Bridge – komunikacja USB |
| Python 3.9+ | Uruchomienie display.py |

**Na urządzeniu:** nic do instalacji. Busybox `sh`, `cat`, `dd` dostępne out-of-the-box.

---

### 3.7 Jak uruchomić

```bash
# 1. Zainstaluj ADB:
#    Windows: winget install Google.PlatformTools
#    macOS:   brew install android-platform-tools
#    Linux:   sudo apt install adb

# 2. Podłącz D200 przez USB-C

# 3. Zweryfikuj
adb devices
# Oczekiwany output: XXXXXXXX   device

# 4. WAŻNE: sprawdź format framebuffera
adb shell cat /sys/class/graphics/fb0/virtual_size
adb shell cat /sys/class/graphics/fb0/bits_per_pixel
# Zaktualizuj SCREEN_WIDTH/HEIGHT w display.py!

# 5. Zainstaluj zależności
cd ulanzi-demos/shell/demo
python -m venv .venv
source .venv/bin/activate
pip install Pillow psutil

# 6. Live stream (pulsująca animacja)
./push.sh 10
# lub
python src/display.py --stream --fps 10

# 7. Wygeneruj i odtwórz ramki
python src/display.py --generate
python src/display.py --play --fps 30

# --- DIAGNOSTYKA ---
# Sprawdź czy fb0 jest zapisywalny:
adb shell "ls -la /dev/fb0"

# Test ręczny – czarny ekran:
adb shell "dd if=/dev/zero of=/dev/fb0 bs=1024 count=1000"

# Test – szum (ekran = losowe piksele):
adb shell "cat /dev/urandom | dd of=/dev/fb0 bs=1024 count=200"
```

---

### 3.8 Ograniczenia i ryzyka

| Ryzyko | Prawdopodobieństwo | Mitigation |
|---|---|---|
| ADB wyłączony w przyszłym firmware | Niskie-Średnie | Nie aktualizuj firmware bez sprawdzenia changelog |
| Nieznany format pikseli `/dev/fb0` | Wysokie | `get_fb_info()` autodetekcja z `/sys/` |
| Nieznana rozdzielczość (PLACEHOLDER!) | Wysokie | Zawsze czytaj `virtual_size` przed pierwszym push |
| Niska wydajność ADB (latencja 5-15ms/frame) | Wysokie | Max ~10-15 FPS przez ADB; dla 30fps użyj ARM binary |
| Kolizja z UlanziStudio używającym FB | Wysokie | Zatrzymaj/zamknij UlanziStudio przed testem |
| Zapis poza rozdzielczość → crash | Średnie | Zawsze weryfikuj rozmiar przez `get_fb_info()` |

**Znane ograniczenia FPS:**
- ADB overhead: 5-15ms per frame = maks. ~10-20 FPS praktycznie
- Dla 30fps: własny ARM binary (jak `rlaneth/badustudio` w C++)

---

### 3.9 Kluczowe decyzje techniczne

**D1: Host-side rendering (PIL na PC), nie ARM binary.**
Demo = koncept. ARM cross-kompilacja to dodatkowy toolchain. Dla prod: przenieść do binary.

**D2: `dd of=/dev/fb0` przez `adb shell` z piped stdin.**
Najniższa latencja – brak pliku pośredniego. Wymaga dokładnie `bpp * w * h` bajtów.

**D3: Autodetekcja formatu przez `/sys/class/graphics/fb0/`.**
Nie hardkodujemy RGB565 – urządzenie może używać RGBA8888. `get_fb_info()` czyta real values.

**D4: SCREEN_WIDTH/HEIGHT jako PLACEHOLDER wymagające weryfikacji.**
Dokładne wartości nieznane z dokumentacji. `get_fb_info()` automatycznie je pobierze.

**D5: `--stream` jako główny tryb demo.**
Live generowanie pokazuje dynamiczność. `--play` dla wysokiego FPS z pre-cached frames.

---

## 4. Porównanie B1 vs B2

| Kryterium | B1 (Python USB / strmdck) | B2 (ADB Framebuffer) |
|---|---|---|
| Połączenie | USB HID vendor protocol | ADB (USB Debug Bridge) |
| Co kontrolujesz | Per-przycisk (72x72px każdy) | Cały ekran naraz |
| Wymagania | Python + strmdck | Python + `adb` w PATH |
| Windows setup | Zadig dla sterownika | SDK Platform Tools |
| Max FPS | ~30fps | ~10-15fps (ADB); 30fps z ARM binary |
| Obsługa klawiszy | TAK (natywny callback) | NIE (wymaga osobnego mechanizmu) |
| Trudność | Średnia | Średnia setup / Wysoka (ARM binary) |
| Stabilność API | Niska (strmdck RC, community) | Wysoka (ADB + FB = Linux standard) |
| Ryzyko firmware | Wysokie (USB proto może zmienić) | Niskie-Średnie (ADB może wyłączyć) |
| "Wow factor" | Dashboard z live data per-key | Pełnoekranowa animacja / DOOM |

**Rekomendacja:**
- Zacznij od **B2** (ADB) – prostszy setup, nie wymaga strmdck RC, ADB = standard
- Dodaj **B1** gdy strmdck osiągnie stable release

---

## 5. DDD – Słownik pojęć

| Termin | Definicja |
|---|---|
| **D200** | Ulanzi Stream Controller D200 – urządzenie z 13 programowalnymi przyciskami LCD |
| **Framebuffer** | `/dev/fb0` – Linux device plikowy = pamięć ekranu; zapis → wyświetlenie |
| **ADB** | Android Debug Bridge – CLI do komunikacji z urządzeniami Android/Linux przez USB |
| **Buildroot** | System Linux embedded używany jako userspace D200 |
| **RGB565** | Format piksela: 16 bitów (R=5b, G=6b, B=5b) |
| **RGBA8888** | Format piksela: 32 bity (R=8b, G=8b, B=8b, A=8b) |
| **strmdck** | Community Python library (redphx) do kontroli D200 przez USB bez UlanziStudio |
| **UlanziStudio** | Oficjalna aplikacja PC Ulanzi – wymagana dla Podejścia A, nie wymagana dla B |
| **ARMv7** | Architektura ISA procesora D200 (hard-float, 32-bit) |
| **badustudio** | Projekt rlaneth – Bad Apple 30fps na D200 przez ADB + C++ player |
| **Widget** | Abstrakcja B1: funkcja renderująca + metadane dla pojedynczego przycisku |
| **DD** | Unix `dd` – używane do pipe bytes do `/dev/fb0` przez ADB shell |
| **HID** | Human Interface Device – klasa USB używana przez D200 |
