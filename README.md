# ulanzi-deck-d200-plugin-example

Research and example plugins for the **Ulanzi Deck D200** — covering both the official Plugin SDK (via UlanziStudio) and direct USB/ADB access.

See [`CLAUDE.md`](./CLAUDE.md) for project layout and [`ULANZI-SDK-RESEARCH.md`](./ULANZI-SDK-RESEARCH.md) for the full research write-up.

## Quick start

```bash
git clone --recurse-submodules git@github.com:zentala/ulanzi-deck-d200-plugin-example.git
cd ulanzi-deck-d200-plugin-example
pnpm install
```

## Layout
- `ulanzi-demos/plugins/demo/` — example plugin (Method A: Plugin SDK)
- `ulanzi-demos/usb/`, `ulanzi-demos/shell/` — direct USB/ADB experiments (Method B)
- `ulanzi-demos/SPEC-A-plugin-sdk.md`, `SPEC-B-direct-access.md` — specs
