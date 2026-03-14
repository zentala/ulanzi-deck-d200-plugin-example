"""Icon generation utilities for Ulanzi D200 USB demo.

All icons are PIL Images sized 72x72 px (native D200 button size).
Uses only PIL default font to avoid system font dependencies.
"""
from __future__ import annotations

import datetime
import io

import psutil
from PIL import Image, ImageDraw

BUTTON_SIZE = 72


class IconGenerator:
    """Static factory methods for generating PIL images for D200 buttons.

    Each method returns a PIL Image ready to be converted to JPEG bytes
    via :meth:`to_bytes` and sent to strmdck's ``set_key_image()``.
    """

    @staticmethod
    def clock_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current local time (HH:MM) on a dark navy background.

        Args:
            size: Square icon side length in pixels. Defaults to 72.

        Returns:
            PIL Image with current time centered on #16213e background.
        """
        now = datetime.datetime.now().strftime("%H:%M")
        return IconGenerator.text_icon(
            text=now,
            bg_color="#16213e",
            text_color="#00d4ff",
            size=size,
        )

    @staticmethod
    def cpu_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current CPU usage percentage with color-coded background.

        Color thresholds:
            - green  (#44cc44): usage <= 50 %
            - yellow (#ffaa00): 50 % < usage <= 80 %
            - red    (#ff4444): usage > 80 %

        Uses ``psutil.cpu_percent(interval=None)`` (non-blocking).

        Args:
            size: Square icon side length in pixels. Defaults to 72.

        Returns:
            PIL Image showing CPU % with color-coded background.
        """
        usage: float = psutil.cpu_percent(interval=None)
        if usage > 80:
            color = "#ff4444"
        elif usage > 50:
            color = "#ffaa00"
        else:
            color = "#44cc44"
        return IconGenerator.text_icon(
            text=f"{usage:.0f}%",
            bg_color=color,
            label="CPU",
            size=size,
        )

    @staticmethod
    def ram_icon(size: int = BUTTON_SIZE) -> Image.Image:
        """Render current RAM usage percentage with color-coded background.

        Color thresholds:
            - blue (#2244aa): usage <= 90 %
            - red  (#ff4444): usage > 90 %

        Args:
            size: Square icon side length in pixels. Defaults to 72.

        Returns:
            PIL Image showing RAM % with color-coded background.
        """
        usage: float = psutil.virtual_memory().percent
        color = "#ff4444" if usage > 90 else "#2244aa"
        return IconGenerator.text_icon(
            text=f"{usage:.0f}%",
            bg_color=color,
            label="RAM",
            size=size,
        )

    @staticmethod
    def text_icon(
        text: str,
        bg_color: str = "#1a1a2e",
        text_color: str = "#ffffff",
        label: str = "",
        size: int = BUTTON_SIZE,
    ) -> Image.Image:
        """Render arbitrary text centered on a solid colored background.

        An optional smaller label is drawn near the bottom of the icon,
        useful for annotating metric names (e.g. "CPU", "RAM").

        Args:
            text: Primary text to display centered in the icon.
            bg_color: Background fill color as hex string (e.g. "#1a1a2e").
            text_color: Primary text color as hex string.
            label: Optional secondary label drawn near the bottom edge.
            size: Square icon side length in pixels. Defaults to 72.

        Returns:
            PIL RGB Image with text rendered using the PIL default font.
        """
        img = Image.new("RGB", (size, size), bg_color)
        draw = ImageDraw.Draw(img)
        draw.text((size // 2, size // 2 - 8), text, fill=text_color, anchor="mm")
        if label:
            draw.text((size // 2, size - 10), label, fill="#aaaaaa", anchor="mm")
        return img

    @staticmethod
    def to_bytes(img: Image.Image) -> bytes:
        """Convert a PIL Image to JPEG bytes for ``strmdck.set_key_image()``.

        Uses JPEG quality=85 for a good balance of image fidelity and
        transfer size over USB.

        Args:
            img: PIL Image to encode.

        Returns:
            JPEG-encoded bytes.
        """
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
