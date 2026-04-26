# Backlog

Ideas not yet planned into an epic. Lightweight list — no ceremony.

## DX / Repo polish

- [ ] **Screenshot or short GIF of plugin running on D200 in root README** — strongest magnet for new users; needs to be filmed once on real hardware
- [ ] Add a `Makefile` (or root `package.json` task) to run all tests across demos with one command
- [ ] CI: extend GitHub Actions to actually run plugin tests on push (currently lint-only); needs to verify pnpm + Jest in CI
- [ ] Pre-built plugin zip release on GitHub (so non-devs can install without building)
- [ ] **Upgrade GitHub Actions to Node 24 runtime before 2026-06-02 deadline** — `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`, `pnpm/action-setup@v4` are deprecated (Node 20). **First step: check library/action compatibility** — verify each action's latest version, that pnpm v10 + lockfile work on the new runtime, that pytest 3.11 setup is unchanged. Only then bump the workflow.
- [ ] **Add a manifest↔code UUID consistency test** — Jest test that parses `manifest.json` and asserts every action UUID is present in `plugin/uuids.js` and vice versa. Catches drift like the clock inspector having `com.ulanzi.demo.clock` (3-segment) while manifest had `com.ulanzi.ulanzideck.demo.clock` (5-segment) — pre-existing bug fixed during 2026-04-26 rename.
- [x] **Enable real `pnpm typecheck` for plugin demo** — Done in `f5bd304` (merged via `feat/typecheck-real`). Caught 2 latent bugs: `autoPaused` field missing from PomodoroAction JSDoc, `|| {}` fallback masking alert shape in StatusAction. Wired into pre-commit and CI between lint and test.

## Plugin demo

- [ ] More actions to showcase the SDK surface: weather, notifications, media controls
- [ ] Screenshot per action in plugin README

## USB demo

- [ ] Replace `strmdck` pre-release with a stable version once upstream tags one
- [ ] Add layout switching (different button arrangements via CLI flag)

## Shell demo

- [ ] Native ARM binary (Approach B1 in research file) for full 30+ fps
- [ ] Detect when stock launcher repaints over output and auto-recover
