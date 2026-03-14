# Ulanzi D200 – ADB Framebuffer Demo (Approach B2)

Streams pixel data directly to `/dev/fb0` on the Ulanzi D200 over ADB.
No UlanziStudio, no proprietary SDK, no app installation required.
Works on any OS with ADB installed.

## What it does

- Connects to the D200 via USB ADB
- Reads the framebuffer geometry from `/sys/class/graphics/fb0/`
- Renders animation frames with Pillow (clock or RGB pulse)
- Pipes raw pixel bytes into `adb shell dd of=/dev/fb0`

Modes available:

| Mode | Flag | Description |
|------|------|-------------|
| Stream (default) | `--stream` | Real-time pulse animation |
| Generate frames | `--generate` | Pre-render PNG frames to disk |
| Play frames | `--play` | Push pre-rendered PNGs to device |

## Hardware requirements

- Ulanzi D200 smart display (480×272 LCD)
- ADB root shell enabled (factory default on most units)
- USB-A to USB-C cable

The D200 ships with an open ADB root shell. **Firmware updates may disable
this.** Do not update firmware if you rely on ADB access.

## ADB installation

| Platform | Command |
|----------|---------|
| Windows  | `winget install Google.PlatformTools` |
| macOS    | `brew install android-platform-tools` |
| Ubuntu/Debian | `sudo apt install adb` |

Verify with `adb version`.

## IMPORTANT – Verify framebuffer format before use

The default constants assume 480×272 RGB565. Confirm your device:

```bash
adb shell cat /sys/class/graphics/fb0/virtual_size   # e.g. 480x272
adb shell cat /sys/class/graphics/fb0/bits_per_pixel # e.g. 16 or 32
adb shell cat /sys/class/graphics/fb0/stride         # bytes per row
```

If `bits_per_pixel` is 32 the code selects RGBA8888 automatically.
If the resolution differs from 480×272, update `SCREEN_WIDTH`/`SCREEN_HEIGHT`
in `src/display.py`.

## Installation

```bash
pip install -r requirements.txt
```

Python 3.9+ required.

## Usage

### Quickstart (shell script – recommended)

```bash
chmod +x push.sh
./push.sh          # 10 fps default
./push.sh 15       # custom fps
```

### Direct Python

```bash
# Stream live animation
python -m src.display --stream --fps 10

# Pre-render 60 frames to assets/frames/
python -m src.display --generate --frames-dir assets/frames

# Play back pre-rendered frames
python -m src.display --play --frames-dir assets/frames --fps 10
```

## Diagnostics

```bash
# Check device is visible
adb devices

# List framebuffer device
adb shell ls -la /dev/fb0

# Test framebuffer write access (fills screen with zeros = black)
adb shell dd if=/dev/zero of=/dev/fb0 bs=1024 count=270

# Dump current framebuffer to host
adb shell dd if=/dev/fb0 > screen_dump.raw

# Read all framebuffer sysfs attributes
adb shell cat /sys/class/graphics/fb0/virtual_size \
              /sys/class/graphics/fb0/bits_per_pixel \
              /sys/class/graphics/fb0/stride
```

## Known limitations

- Practical throughput via ADB is ~10–15 fps (USB 2.0 + ADB protocol overhead)
- For 30+ fps a native ARM binary running on-device is required (Approach B1)
- `adb shell dd of=/dev/fb0` may produce minor tearing; double-buffering is
  not available through this path
- The D200 firmware may run a watchdog that resets the display; if the stock
  launcher repaints over your output, you may need to kill or replace it

## Warning

Firmware updates from Ulanzi may remove ADB root access.
Do not apply OTA/firmware updates if you depend on this demo.
