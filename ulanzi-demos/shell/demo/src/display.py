"""Display rendering and animation for the Ulanzi D200 ADB framebuffer demo.

Converts Pillow images to raw framebuffer bytes and streams them to /dev/fb0
over ADB. Supports live streaming, PNG frame generation, and PNG playback.
"""

from __future__ import annotations

import argparse
import struct
import sys
import time
from pathlib import Path

from PIL import Image

from .adb_helper import AdbHelper
from .frames import FrameGenerator

# PLACEHOLDERS – verify with: adb shell cat /sys/class/graphics/fb0/virtual_size
# get_fb_info() will detect these automatically at runtime
SCREEN_WIDTH = 480
SCREEN_HEIGHT = 272

# ---------------------------------------------------------------------------
# Pixel format conversion
# ---------------------------------------------------------------------------


def pil_to_rgb565(img: Image.Image) -> bytes:
    """Convert a PIL RGB image to packed little-endian RGB565 bytes.

    Each pixel is encoded as a 16-bit value: RRRRRGGGGGGBBBBB (LE).

    Args:
        img: Source image in RGB mode.

    Returns:
        Raw bytes suitable for writing to a 16-bpp framebuffer.
    """
    rgb = img.convert("RGB")
    pixels = list(rgb.getdata())
    buf = bytearray(len(pixels) * 2)
    for i, (r, g, b) in enumerate(pixels):
        r5 = (r >> 3) & 0x1F
        g6 = (g >> 2) & 0x3F
        b5 = (b >> 3) & 0x1F
        word = (r5 << 11) | (g6 << 5) | b5
        struct.pack_into("<H", buf, i * 2, word)
    return bytes(buf)


def pil_to_rgba8888(img: Image.Image) -> bytes:
    """Convert a PIL image to raw RGBA8888 bytes.

    Args:
        img: Source image (any mode; converted to RGBA internally).

    Returns:
        Raw bytes suitable for writing to a 32-bpp framebuffer.
    """
    return img.convert("RGBA").tobytes()


def image_to_fb_bytes(img: Image.Image, bpp: int) -> bytes:
    """Resize an image to screen dimensions and convert to framebuffer bytes.

    Args:
        img: Source PIL image (any size/mode).
        bpp: Bits per pixel of the target framebuffer (16 or 32).

    Returns:
        Packed pixel bytes ready for /dev/fb0.

    Raises:
        ValueError: If ``bpp`` is not 16 or 32.
    """
    resized = img.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)
    if bpp == 16:
        return pil_to_rgb565(resized)
    if bpp == 32:
        return pil_to_rgba8888(resized)
    raise ValueError(f"Unsupported bits_per_pixel: {bpp}. Expected 16 or 32.")


# ---------------------------------------------------------------------------
# Animation helpers
# ---------------------------------------------------------------------------


def stream_animation(adb: AdbHelper, fps: int = 10) -> None:
    """Stream a live pulse animation to the device framebuffer.

    Loops indefinitely, generating pulse frames and pushing each to
    ``/dev/fb0`` via ADB. Press Ctrl+C to stop; the screen is cleared to
    black before exit.

    Args:
        adb: Initialised :class:`AdbHelper` instance.
        fps: Target frames per second (default 10).
    """
    fb_info = adb.get_fb_info()
    w, h, bpp = fb_info["width"], fb_info["height"], fb_info["bits_per_pixel"]
    interval = 1.0 / fps
    gen = FrameGenerator()
    t = 0.0
    print(f"[stream] {w}x{h} @ {bpp}bpp – streaming at {fps} fps. Ctrl+C to stop.")
    try:
        while True:
            frame = gen.pulse_frame(w, h, t)
            adb.push_raw_to_fb(image_to_fb_bytes(frame, bpp))
            t += interval
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[stream] Interrupted – clearing screen to black.")
        black = Image.new("RGB", (w, h), color=(0, 0, 0))
        adb.push_raw_to_fb(image_to_fb_bytes(black, bpp))


def _generate_frames(output_dir: Path, count: int = 60) -> None:
    """Pre-render animation frames and save them as PNG files.

    Args:
        output_dir: Directory in which to write ``frame_NNNN.png`` files.
        count: Number of frames to generate (default 60).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    gen = FrameGenerator()
    for i in range(count):
        frame = gen.pulse_frame(SCREEN_WIDTH, SCREEN_HEIGHT, i / 10.0)
        path = output_dir / f"frame_{i:04d}.png"
        frame.save(path)
        print(f"[generate] saved {path}")
    print(f"[generate] {count} frames written to {output_dir}")


def _play_frames(adb: AdbHelper, frames_dir: Path, fps: int) -> None:
    """Loop over pre-generated PNG frames and push them to the framebuffer.

    Args:
        adb: Initialised :class:`AdbHelper` instance.
        frames_dir: Directory containing ``frame_NNNN.png`` files.
        fps: Playback frames per second.
    """
    fb_info = adb.get_fb_info()
    bpp = fb_info["bits_per_pixel"]
    interval = 1.0 / fps
    pngs = sorted(frames_dir.glob("frame_*.png"))
    if not pngs:
        print(f"[play] No frame_*.png files found in {frames_dir}")
        return
    print(f"[play] {len(pngs)} frames at {fps} fps. Ctrl+C to stop.")
    try:
        while True:
            for png in pngs:
                adb.push_raw_to_fb(image_to_fb_bytes(Image.open(png), bpp))
                time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[play] Stopped.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """CLI entry point for the ADB framebuffer demo.

    Subcommands (mutually exclusive flags):
    - ``--stream`` (default): live animation streamed to the device.
    - ``--generate``: pre-render PNG frames to ``--frames-dir``.
    - ``--play``: play back PNG frames from ``--frames-dir``.

    Returns:
        Exit code (0 on success, 1 on error).
    """
    parser = argparse.ArgumentParser(
        description="Ulanzi D200 ADB framebuffer demo (Approach B2)",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--stream", action="store_true", default=True, help="Stream live animation (default)")
    mode.add_argument("--generate", action="store_true", help="Pre-render PNG frames")
    mode.add_argument("--play", action="store_true", help="Play back pre-rendered PNG frames")
    parser.add_argument("--fps", type=int, default=10, help="Frames per second (default 10)")
    parser.add_argument(
        "--frames-dir",
        type=Path,
        default=Path(__file__).parent.parent / "assets" / "frames",
        help="Directory for PNG frame files",
    )
    args = parser.parse_args()

    adb = AdbHelper()
    try:
        serial = adb.check_device()
        print(f"[main] ADB device: {serial}")
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.generate:
        _generate_frames(args.frames_dir)
    elif args.play:
        _play_frames(adb, args.frames_dir, args.fps)
    else:
        stream_animation(adb, fps=args.fps)

    return 0


if __name__ == "__main__":
    sys.exit(main())
