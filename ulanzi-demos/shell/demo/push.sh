#!/usr/bin/env bash
# push.sh – Deploy and run ADB framebuffer demo on Ulanzi D200
# Usage: ./push.sh [fps]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FPS="${1:-10}"

echo "[push.sh] Checking ADB device..."
if ! adb devices | grep -q "device$"; then
    echo "ERROR: No ADB device found. Connect D200 via USB."
    exit 1
fi

echo "[push.sh] Framebuffer info:"
adb shell "cat /sys/class/graphics/fb0/virtual_size \
           /sys/class/graphics/fb0/bits_per_pixel \
           /sys/class/graphics/fb0/stride" || true

cd "${SCRIPT_DIR}"
python -m src.display --stream --fps "${FPS}"
