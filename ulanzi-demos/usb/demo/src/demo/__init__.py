"""Ulanzi D200 USB dashboard demo package.

Provides high-level abstractions for building live dashboards on the
Ulanzi D200 Stream Controller via USB, without requiring UlanziStudio.

Exports:
    VERSION: Package version string.
    Dashboard: Orchestrates widgets across D200 button slots.
    IconGenerator: Static factory for PIL button images.
    Widget: Dataclass binding a render callable to a button slot.
"""
from __future__ import annotations

from .dashboard import Dashboard, Widget
from .icons import IconGenerator

VERSION = "0.1.0"

__all__ = ["VERSION", "Dashboard", "IconGenerator", "Widget"]
