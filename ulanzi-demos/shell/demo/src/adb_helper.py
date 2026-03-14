"""ADB helper utilities for the Ulanzi D200 framebuffer demo.

Provides a thin wrapper around the ``adb`` CLI for device detection,
shell command execution, file push, and raw framebuffer writes.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


class AdbHelper:
    """Wrapper around the ADB command-line tool targeting the Ulanzi D200.

    All methods raise :class:`subprocess.CalledProcessError` on non-zero
    ADB exit codes unless otherwise noted.
    """

    FB0_PATH: str = "/dev/fb0"

    # ---------------------------------------------------------------------------
    # Device management
    # ---------------------------------------------------------------------------

    def check_device(self) -> str:
        """Verify that exactly one ADB device is attached and return its serial.

        Runs ``adb devices`` and looks for lines that end with ``\\tdevice``.

        Returns:
            The serial number of the first detected device.

        Raises:
            RuntimeError: If no device is found.
        """
        result = subprocess.run(
            ["adb", "devices"],
            capture_output=True,
            text=True,
            check=True,
        )
        serials: list[str] = []
        for line in result.stdout.splitlines():
            if line.endswith("\tdevice"):
                serial = line.split("\t")[0].strip()
                serials.append(serial)

        if not serials:
            raise RuntimeError(
                "No ADB device found. Connect the Ulanzi D200 via USB and "
                "ensure ADB is enabled (developer options)."
            )
        return serials[0]

    # ---------------------------------------------------------------------------
    # Shell / file operations
    # ---------------------------------------------------------------------------

    def shell(self, cmd: str) -> subprocess.CompletedProcess[str]:
        """Run a shell command on the connected device.

        Args:
            cmd: Shell command string to execute on the device.

        Returns:
            Completed process with captured stdout/stderr.
        """
        return subprocess.run(
            ["adb", "shell", cmd],
            capture_output=True,
            text=True,
            check=True,
        )

    def push(self, local: Path, remote: str) -> None:
        """Push a local file to the device.

        Args:
            local: Path to the local file.
            remote: Destination path on the device.
        """
        subprocess.run(
            ["adb", "push", str(local), remote],
            check=True,
        )

    def push_raw_to_fb(self, raw_bytes: bytes) -> None:
        """Write raw pixel bytes directly to /dev/fb0 on the device.

        Pipes ``raw_bytes`` into ``adb shell dd of=/dev/fb0`` via stdin.
        Deliberately uses binary mode (no ``text=True``) so the pixel data
        is not mangled by any newline translation.

        Args:
            raw_bytes: Packed pixel data in the format expected by the
                framebuffer (e.g. RGB565 or RGBA8888).
        """
        subprocess.run(
            ["adb", "shell", "dd of=/dev/fb0"],
            input=raw_bytes,
            check=True,
        )

    # ---------------------------------------------------------------------------
    # Framebuffer info
    # ---------------------------------------------------------------------------

    def get_fb_info(self) -> dict[str, int]:
        """Read framebuffer geometry from sysfs.

        Reads ``virtual_size``, ``bits_per_pixel``, and ``stride`` from
        ``/sys/class/graphics/fb0/``.

        Returns:
            Dictionary with keys:
            - ``"width"``  – horizontal resolution in pixels
            - ``"height"`` – vertical resolution in pixels
            - ``"bits_per_pixel"`` – colour depth (typically 16 or 32)
            - ``"stride"`` – bytes per scanline

        Raises:
            subprocess.CalledProcessError: If any sysfs read fails.
            ValueError: If sysfs values cannot be parsed as integers.
        """
        base = "/sys/class/graphics/fb0"

        virtual_size = self.shell(f"cat {base}/virtual_size").stdout.strip()
        bpp_str = self.shell(f"cat {base}/bits_per_pixel").stdout.strip()
        stride_str = self.shell(f"cat {base}/stride").stdout.strip()

        # virtual_size is "WxH" e.g. "480x272"
        width_str, height_str = virtual_size.split("x")
        return {
            "width": int(width_str),
            "height": int(height_str),
            "bits_per_pixel": int(bpp_str),
            "stride": int(stride_str),
        }
