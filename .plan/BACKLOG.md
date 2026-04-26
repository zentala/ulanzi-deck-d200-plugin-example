# Backlog

Ideas not yet planned into an epic. Lightweight list — no ceremony.

## DX / Repo polish

- [ ] **Screenshot or short GIF of plugin running on D200 in root README** — strongest magnet for new users; needs to be filmed once on real hardware
- [ ] Add a `Makefile` (or root `package.json` task) to run all tests across demos with one command
- [ ] CI: extend GitHub Actions to actually run plugin tests on push (currently lint-only); needs to verify pnpm + Jest in CI
- [ ] Pre-built plugin zip release on GitHub (so non-devs can install without building)

## Plugin demo

- [ ] More actions to showcase the SDK surface: weather, notifications, media controls
- [ ] Screenshot per action in plugin README

## USB demo

- [ ] Replace `strmdck` pre-release with a stable version once upstream tags one
- [ ] Add layout switching (different button arrangements via CLI flag)

## Shell demo

- [ ] Native ARM binary (Approach B1 in research file) for full 30+ fps
- [ ] Detect when stock launcher repaints over output and auto-recover
