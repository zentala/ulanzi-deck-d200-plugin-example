# Changelog

All notable changes to this repository — both the example plugin (Approach A)
and the direct-access demos (Approach B1, B2). Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version applies to the **example plugin** (Approach A). Approach B demos
ship from the same tag but don't have their own version bump; their changes
are listed under the same release header.

## [Unreleased]

### Added
- WeatherAction: clamp `refreshMin` to 5-minute floor (matches PI `min` attribute and respects open-meteo's free-tier guidance).
- Comprehensive Canvas2D mock surface in `tests/helpers.js` — single source of truth shared with `dispatcher.test.js`. Future render primitives won't break the test suite.
- Release workflow now runs lint + format + typecheck + tests before publishing the zip.
- Manifest consistency tests now also verify that every `Icon`, `States[].Image`, plugin `Icon`, and `CategoryIcon` PNG file exists on disk — same class of bug as the existing PropertyInspector check (130 tests, was 126).

## [0.1.0] — 2026-04-27

First public release.

### Added — Approach A (Plugin SDK demo)
- Six demo actions: Clock, Counter, CPU Status, Calendar, Pomodoro, Weather.
- ClockAction: configurable IANA timezones with animated seconds-progress border.
- CounterAction: tap-to-count with persisted settings, configurable step / direction / colors.
- StatusAction: CPU load + temperature monitor reading LibreHardwareMonitor HTTP API; Web Worker fallback when LHM is unavailable; EMA smoothing; configurable overheat threshold + alert.
- CalendarAction: torn-off date display refreshing at midnight; tap opens a configurable calendar URL (Google / Outlook / iCloud / Proton).
- PomodoroAction: work/break state machine with auto-pause on view inactive; configurable durations.
- WeatherAction: current temperature + WMO condition from [open-meteo.com](https://open-meteo.com); no API key; configurable location, label, units, refresh interval.
- All weather and pomodoro icons drawn as canvas vector primitives — no emoji font dependency.
- Single source of truth for action UUIDs in `plugin/uuids.js`, shared by manifest, app.js, every Property Inspector, and the Jest tests.
- Manifest ↔ uuids consistency test catching pre-existing 3-segment vs 5-segment UUID drift.
- Auto-regenerated button preview PNGs (`assets/previews/*.png`) embedded in README; pre-commit hook regenerates them whenever an action's source file changes.
- Husky pre-commit (lint, format, typecheck, preview regen) and pre-push (full Jest suite).
- 126 Jest tests covering every action, the dispatcher, and manifest consistency.

### Added — Approach B1 (Python USB dashboard)
- Live 4-button dashboard via `redphx/strmdck`: clock, CPU%, RAM%, static label.
- Hatchling build; pytest with 80% coverage gate; ruff lint.
- Windows Zadig instructions for WinUSB driver setup.

### Added — Approach B2 (ADB framebuffer)
- Three modes: `--stream` (real-time pulse), `--generate` (pre-render PNG frames), `--play` (push frames to device).
- Auto-detects framebuffer geometry from `/sys/class/graphics/fb0/`; supports RGB565 and RGBA8888 with numpy fast-path.
- ~10–15 fps over USB 2.0 + ADB protocol overhead.

### Added — Repo infrastructure
- MIT LICENSE; CONTRIBUTING.md; .editorconfig; .nvmrc.
- GitHub Actions: CI (lint + tests on push), Release (zip on `v*` tag).
- Issue templates (bug report, feature request) and PR template.
- Comprehensive research write-up: [`docs/ULANZI-SDK-RESEARCH.md`](docs/ULANZI-SDK-RESEARCH.md).
- Specs: [`SPEC-A-plugin-sdk.md`](ulanzi-demos/SPEC-A-plugin-sdk.md), [`SPEC-B-direct-access.md`](ulanzi-demos/SPEC-B-direct-access.md).

[Unreleased]: https://github.com/zentala/ulanzi-deck-d200-plugin-example/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zentala/ulanzi-deck-d200-plugin-example/releases/tag/v0.1.0
