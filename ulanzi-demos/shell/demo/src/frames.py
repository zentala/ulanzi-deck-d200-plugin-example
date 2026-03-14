"""Frame generation for the Ulanzi D200 ADB framebuffer demo.

Provides :class:`FrameGenerator` with static factory methods for clock and
colour-pulse animation frames rendered using Pillow.
"""

from __future__ import annotations

import math
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont


class FrameGenerator:
    """Factory for demo animation frames rendered with Pillow."""

    @staticmethod
    def clock_frame(w: int, h: int) -> Image.Image:
        """Render a full-screen digital clock.

        Background is near-black (#0a0a1a). The time (HH:MM:SS) is drawn in
        cyan (#00d4ff) and the date below it in grey (#666666).

        Args:
            w: Frame width in pixels.
            h: Frame height in pixels.

        Returns:
            Rendered PIL image.
        """
        img = Image.new("RGB", (w, h), color=(10, 10, 26))
        draw = ImageDraw.Draw(img)
        now = datetime.now()
        time_str = now.strftime("%H:%M:%S")
        date_str = now.strftime("%A, %d %B %Y")

        try:
            font_large = ImageFont.truetype("DejaVuSans-Bold.ttf", 72)
            font_small = ImageFont.truetype("DejaVuSans.ttf", 28)
        except OSError:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), time_str, font=font_large)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(
            ((w - tw) // 2, (h - th) // 2 - 20),
            time_str,
            fill=(0, 212, 255),
            font=font_large,
        )

        bbox_d = draw.textbbox((0, 0), date_str, font=font_small)
        dw = bbox_d[2] - bbox_d[0]
        draw.text(
            ((w - dw) // 2, (h + th) // 2),
            date_str,
            fill=(102, 102, 102),
            font=font_small,
        )
        return img

    @staticmethod
    def pulse_frame(w: int, h: int, t: float) -> Image.Image:
        """Render an RGB colour-pulse frame with centred "D200" label.

        The background colour cycles through RGB using sinusoidal oscillators
        with 120-degree phase offsets. White "D200" text is drawn in the centre.

        Args:
            w: Frame width in pixels.
            h: Frame height in pixels.
            t: Time parameter (seconds) driving the colour animation.

        Returns:
            Rendered PIL image.
        """
        r = int((math.sin(t * 2 + 0.0) * 0.5 + 0.5) * 200)
        g = int((math.sin(t * 2 + 2.094) * 0.5 + 0.5) * 200)  # +2pi/3
        b = int((math.sin(t * 2 + 4.189) * 0.5 + 0.5) * 200)  # +4pi/3

        img = Image.new("RGB", (w, h), color=(r, g, b))
        draw = ImageDraw.Draw(img)

        try:
            font = ImageFont.truetype("DejaVuSans-Bold.ttf", 64)
        except OSError:
            font = ImageFont.load_default()

        label = "D200"
        bbox = draw.textbbox((0, 0), label, font=font)
        lw, lh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((w - lw) // 2, (h - lh) // 2), label, fill=(255, 255, 255), font=font)
        return img
