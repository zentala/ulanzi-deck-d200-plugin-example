# Backlog

Ideas not yet planned into an epic. Lightweight list — no ceremony.

## DX / Repo polish

- [ ] **Screenshot or short GIF of plugin running on D200 in root README** — strongest magnet for new users; needs to be filmed once on real hardware
- [ ] Add a `Makefile` (or root `package.json` task) to run all tests across demos with one command
- [ ] CI: extend GitHub Actions to actually run plugin tests on push (currently lint-only); needs to verify pnpm + Jest in CI
- [x] **Pre-built plugin zip release on GitHub** — `.github/workflows/release.yml` builds + uploads `io.zentala.ulanzideck.demo-<tag>.zip` on every `v*` tag push. Non-devs unzip into the UlanziStudio plugins folder, no git/pnpm needed.
- [ ] **Upgrade GitHub Actions to Node 24 runtime before 2026-06-02 deadline** — `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`, `pnpm/action-setup@v4` are deprecated (Node 20). **First step: check library/action compatibility** — verify each action's latest version, that pnpm v10 + lockfile work on the new runtime, that pytest 3.11 setup is unchanged. Only then bump the workflow.
- [x] **Add a manifest↔code UUID consistency test** — Done in `14bbdb4`. 5-test suite in `tests/manifest.test.js` covering plugin UUID match, action UUID coverage both ways, plugin prefix, and PI file existence on disk.
- [x] **Enable real `pnpm typecheck` for plugin demo** — Done in `f5bd304` (merged via `feat/typecheck-real`). Caught 2 latent bugs: `autoPaused` field missing from PomodoroAction JSDoc, `|| {}` fallback masking alert shape in StatusAction. Wired into pre-commit and CI between lint and test.

## Plugin demo

- [ ] More actions to showcase the SDK surface: notifications, media controls
- [ ] Screenshot per action in plugin README
- [ ] **Voice dictation action (Wispr Flow trigger)** — single-button action that fires a configurable hotkey (default `ctrl+alt+space` — Wispr Flow's default activation) via `$UD.hotkey()`. Visual: idle mic icon → recording state with pulsing ring while held. Educational value: shows hotkey dispatch + button visual feedback for stateful input. Generic enough that it works with any push-to-talk tool (Wispr Flow, Whisper Memos, Win+H Windows dictation, macOS Voice Control).
- [ ] **PowerShell / quick-command launcher action** — press launches a configurable command bar (Windows Terminal quake mode `wt.exe` with `--quake`, or PowerToys Run, or a user-specified executable + args). Settings: `command`, `args[]`, `workingDir`. Educational value: shows `$UD.openUrl()` for custom protocols + how to spawn external processes from a button. Generic launcher pattern reusable for any CLI/REPL.

## USB demo

- [ ] Replace `strmdck` pre-release with a stable version once upstream tags one
- [ ] Add layout switching (different button arrangements via CLI flag)

## Plugin demo — known concerns

- [x] **Verify weather emoji render on real D200** — Resolved preventively in `89d6b54`: replaced all emoji glyphs (☀ ⛅ 🌧 ⚠ … etc.) with canvas vector primitives. No font dependency, identical render across @napi-rs/canvas, Chromium, and any future runtime.

## Shell demo

- [ ] Native ARM binary (Approach B1 in research file) for full 30+ fps
- [ ] Detect when stock launcher repaints over output and auto-recover
