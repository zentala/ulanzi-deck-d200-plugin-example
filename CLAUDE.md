# zntl-ulanzi

Research + demos for building custom plugins and direct device access for the **Ulanzi D200** (smart key/desk display).

## Purpose
- Document two integration paths: official **Plugin SDK** (via UlanziStudio) and **direct USB/ADB** access.
- Provide working demo plugins and USB experiments.

## Layout
- `ULANZI-SDK-RESEARCH.md` — main research write-up.
- `ulanzi-demos/`
  - `SPEC-A-plugin-sdk.md`, `SPEC-B-direct-access.md` — specs for both paths.
  - `plugins/demo/io.zentala.ulanzideck.demo.ulanziPlugin/` — demo plugin (Method A). Submodules: `plugin-common-node`, `plugin-common-html`. UUIDs in `plugin/uuids.js`.
  - `shell/`, `usb/` — direct-access experiments.
- `.agent/vision/` — long-term vision notes.

## Conventions
- Package manager: **pnpm**.
- Line endings: LF (see `.gitattributes`).
- Husky configured (`pnpm install` to activate).
- Submodules: clone with `git clone --recurse-submodules` or run `git submodule update --init --recursive`.

## Related skill
For implementing plugin actions (Method A: browser JS + canvas), use the `ulanzi-button` skill.
