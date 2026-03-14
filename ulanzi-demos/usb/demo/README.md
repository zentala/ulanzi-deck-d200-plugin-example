# Ulanzi D200 USB Dashboard Demo (Approach B1)

A Python dashboard that drives the Ulanzi D200 Stream Controller buttons
directly over USB — **no UlanziStudio required**.

Displays live system metrics (clock, CPU, RAM) on the hardware LCD buttons
and reacts to key-press events via a callback.

---

## What it does

- Renders live data on individual D200 buttons (72x72 px JPEG each):
  - **Key 0** – current time (HH:MM)
  - **Key 1** – CPU usage % (color-coded: green/yellow/red)
  - **Key 2** – RAM usage % (color-coded)
  - **Key 3** – static "DEMO" label
- Responds to button presses and prints events to stdout
- Graceful shutdown (Ctrl+C): blanks all buttons before exiting
- Configurable refresh rate via `--fps`

---

## Requirements

### Hardware

- Ulanzi Stream Controller D200 connected via USB-C

### Software

- Python 3.9 or later
- [`strmdck`](https://github.com/redphx/strmdck) >= 0.1.0rc1 (pre-release — see note below)
- Pillow >= 10.0.0
- psutil >= 5.9.0

### Windows: Zadig USB driver

On Windows, without UlanziStudio installed, the D200 may lack the WinUSB driver
needed for libusb/strmdck access.

**Fix:**

1. Download [Zadig](https://zadig.akeo.ie/)
2. Connect the D200 via USB-C
3. In Zadig: select the "Ulanzi D200" device from the dropdown
4. Choose driver: **WinUSB** (or libusb-win32)
5. Click **Install Driver**
6. Close UlanziStudio if it is running — it holds exclusive USB access

> You only need to do this once per machine.

---

## Installation

```bash
# 1. Connect D200 via USB-C and close UlanziStudio

# 2. Clone / enter the directory
cd ulanzi-demos/usb/demo

# 3. Create and activate a virtual environment
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# 4. Install the package and its dependencies
pip install -e .
```

---

## Usage

```bash
# Default: 2 FPS refresh
ulanzi-usb-demo

# Faster refresh
ulanzi-usb-demo --fps 5

# Verbose output
ulanzi-usb-demo --fps 2 --verbose

# Stop: press Ctrl+C
# The dashboard will blank all registered buttons before exiting.
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--fps N` | `2` | Refresh rate in frames per second |
| `--verbose` | off | Print connection and shutdown messages |

---

## Running tests

```bash
# Install test dependencies
pip install pytest pytest-cov

# Run all tests with coverage (80 % minimum enforced)
pytest

# Run a specific test file
pytest tests/test_icons.py -v
```

Tests do **not** require a physical D200 device:

- `tests/test_icons.py` — unit tests for `IconGenerator` (psutil mocked)
- `tests/test_dashboard.py` — unit tests for `Dashboard` (device mocked with `MagicMock`)

---

## Project structure

```
usb/demo/
├── pyproject.toml          # Package metadata, dependencies, pytest config
├── README.md               # This file
├── src/
│   └── demo/
│       ├── __init__.py     # Package exports: Dashboard, IconGenerator, Widget, VERSION
│       ├── main.py         # CLI entry point: argparse, connect, signal handlers
│       ├── dashboard.py    # Widget loop: slot map, update_all, clear_all
│       └── icons.py        # PIL rendering: clock_icon, cpu_icon, ram_icon, text_icon
└── tests/
    ├── __init__.py
    ├── test_icons.py       # IconGenerator unit tests
    └── test_dashboard.py   # Dashboard unit tests
```

---

## strmdck pre-release note

`strmdck` is a community library in pre-release (RC) status as of 2026.
The D200 USB protocol was reverse-engineered from Wireshark captures and may
change with firmware updates.

Recommendations:

- **Pin the version**: keep `strmdck>=0.1.0rc1,<0.2.0` in your environment
- **Do not update D200 firmware** without checking the strmdck changelog first
- If strmdck's API changes, the isolation layer in `dashboard.py`
  (`Widget.render → set_key_image`) means only `main.py` needs updating

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ImportError: No module named 'strmdck'` | Run `pip install 'strmdck>=0.1.0rc1'` |
| `ERROR: Could not connect to D200` | Close UlanziStudio; check USB cable; Windows: run Zadig |
| No device found on Windows | Install WinUSB driver via Zadig (see above) |
| Buttons not updating | Increase `--fps`; ensure D200 is not in sleep mode |
| `ModuleNotFoundError: Pillow` | Run `pip install Pillow>=10.0.0` |
