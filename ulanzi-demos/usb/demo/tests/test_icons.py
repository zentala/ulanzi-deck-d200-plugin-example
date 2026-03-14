"""Unit tests for IconGenerator.

All tests run without a physical device – psutil calls are mocked to
provide deterministic values, and only the PIL + io stdlib is needed.
"""
from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from demo.icons import BUTTON_SIZE, IconGenerator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_virtual_memory(percent: float) -> MagicMock:
    """Return a mock matching the psutil.virtual_memory() return type."""
    vm = MagicMock()
    vm.percent = percent
    return vm


# ---------------------------------------------------------------------------
# clock_icon
# ---------------------------------------------------------------------------

class TestClockIcon:
    """Tests for IconGenerator.clock_icon."""

    def test_clock_icon_returns_pil_image(self) -> None:
        """clock_icon() must return a PIL Image instance."""
        img = IconGenerator.clock_icon()
        assert isinstance(img, Image.Image)

    def test_clock_icon_default_size(self) -> None:
        """clock_icon() must produce a BUTTON_SIZE × BUTTON_SIZE image."""
        img = IconGenerator.clock_icon()
        assert img.size == (BUTTON_SIZE, BUTTON_SIZE)

    def test_clock_icon_custom_size(self) -> None:
        """clock_icon(size=48) must produce a 48×48 image."""
        img = IconGenerator.clock_icon(size=48)
        assert img.size == (48, 48)

    def test_clock_icon_mode_rgb(self) -> None:
        """clock_icon() must return an RGB image."""
        img = IconGenerator.clock_icon()
        assert img.mode == "RGB"


# ---------------------------------------------------------------------------
# cpu_icon
# ---------------------------------------------------------------------------

class TestCpuIcon:
    """Tests for IconGenerator.cpu_icon."""

    @patch("demo.icons.psutil.cpu_percent", return_value=30.0)
    def test_cpu_icon_returns_pil_image(self, _mock: MagicMock) -> None:
        """cpu_icon() must return a PIL Image instance."""
        img = IconGenerator.cpu_icon()
        assert isinstance(img, Image.Image)

    @patch("demo.icons.psutil.cpu_percent", return_value=30.0)
    def test_cpu_icon_default_size(self, _mock: MagicMock) -> None:
        """cpu_icon() must produce a BUTTON_SIZE × BUTTON_SIZE image."""
        img = IconGenerator.cpu_icon()
        assert img.size == (BUTTON_SIZE, BUTTON_SIZE)

    @patch("demo.icons.psutil.cpu_percent", return_value=90.0)
    def test_cpu_icon_high_usage(self, _mock: MagicMock) -> None:
        """cpu_icon() at high usage must still return a valid PIL Image."""
        img = IconGenerator.cpu_icon()
        assert isinstance(img, Image.Image)

    @patch("demo.icons.psutil.cpu_percent", return_value=60.0)
    def test_cpu_icon_medium_usage(self, _mock: MagicMock) -> None:
        """cpu_icon() at medium usage must still return a valid PIL Image."""
        img = IconGenerator.cpu_icon()
        assert isinstance(img, Image.Image)


# ---------------------------------------------------------------------------
# ram_icon
# ---------------------------------------------------------------------------

class TestRamIcon:
    """Tests for IconGenerator.ram_icon."""

    @patch("demo.icons.psutil.virtual_memory", return_value=_fake_virtual_memory(50.0))
    def test_ram_icon_returns_pil_image(self, _mock: MagicMock) -> None:
        """ram_icon() must return a PIL Image instance."""
        img = IconGenerator.ram_icon()
        assert isinstance(img, Image.Image)

    @patch("demo.icons.psutil.virtual_memory", return_value=_fake_virtual_memory(50.0))
    def test_ram_icon_default_size(self, _mock: MagicMock) -> None:
        """ram_icon() must produce a BUTTON_SIZE × BUTTON_SIZE image."""
        img = IconGenerator.ram_icon()
        assert img.size == (BUTTON_SIZE, BUTTON_SIZE)

    @patch("demo.icons.psutil.virtual_memory", return_value=_fake_virtual_memory(95.0))
    def test_ram_icon_high_usage(self, _mock: MagicMock) -> None:
        """ram_icon() at high usage must still return a valid PIL Image."""
        img = IconGenerator.ram_icon()
        assert isinstance(img, Image.Image)


# ---------------------------------------------------------------------------
# text_icon
# ---------------------------------------------------------------------------

class TestTextIcon:
    """Tests for IconGenerator.text_icon."""

    def test_text_icon_correct_size(self) -> None:
        """text_icon() must produce an image of the requested size."""
        img = IconGenerator.text_icon("HI", size=64)
        assert img.size == (64, 64)

    def test_text_icon_default_size(self) -> None:
        """text_icon() with no size argument must use BUTTON_SIZE."""
        img = IconGenerator.text_icon("HI")
        assert img.size == (BUTTON_SIZE, BUTTON_SIZE)

    def test_text_icon_with_label(self) -> None:
        """text_icon() with a label must return a PIL Image without error."""
        img = IconGenerator.text_icon("99%", label="CPU")
        assert isinstance(img, Image.Image)

    def test_text_icon_empty_text(self) -> None:
        """text_icon('') must return a valid PIL Image (used for blanking)."""
        img = IconGenerator.text_icon("")
        assert isinstance(img, Image.Image)

    def test_text_icon_mode_rgb(self) -> None:
        """text_icon() must return an RGB image."""
        img = IconGenerator.text_icon("X")
        assert img.mode == "RGB"

    def test_text_icon_custom_colors(self) -> None:
        """text_icon() with custom bg/text colors must not raise."""
        img = IconGenerator.text_icon("X", bg_color="#330066", text_color="#ff0000")
        assert isinstance(img, Image.Image)


# ---------------------------------------------------------------------------
# to_bytes
# ---------------------------------------------------------------------------

class TestToBytes:
    """Tests for IconGenerator.to_bytes."""

    def test_to_bytes_returns_jpeg_bytes(self) -> None:
        """to_bytes() must return bytes that start with the JPEG magic bytes."""
        img = IconGenerator.text_icon("TEST")
        data = IconGenerator.to_bytes(img)
        assert isinstance(data, bytes)
        # JPEG files start with FF D8
        assert data[:2] == b"\xff\xd8"

    def test_to_bytes_non_empty(self) -> None:
        """to_bytes() must produce a non-empty byte string."""
        img = IconGenerator.text_icon("X")
        data = IconGenerator.to_bytes(img)
        assert len(data) > 0

    def test_to_bytes_roundtrip(self) -> None:
        """Bytes from to_bytes() must be re-openable as a PIL JPEG Image."""
        original = IconGenerator.text_icon("RT", size=72)
        data = IconGenerator.to_bytes(original)
        recovered = Image.open(io.BytesIO(data))
        assert recovered.format == "JPEG"
        assert recovered.size == (72, 72)
