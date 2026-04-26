# Contributing

This is a personal example repo. Contributions welcome but kept minimal.

## What's useful

- Bug reports for setup steps that don't work on your OS
- Docs fixes (typos, unclear instructions, missing prerequisites)
- New actions for the plugin demo (one PR per action)
- Better error messages, troubleshooting entries

## What's out of scope

- Adding non-demo features (this isn't meant to be a full plugin marketplace)
- Refactoring for the sake of refactoring
- Adding dependencies for one-off use cases

## Workflow

1. Fork + branch from `main`
2. For the plugin demo: `pnpm test` must pass; ESLint + Prettier clean
3. For the USB demo: `pytest` must pass; coverage stays ≥ 80%
4. Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
5. PR description: what changed, why, how you tested it

## Testing on real hardware

Most changes can be verified by tests. Anything touching the USB protocol, framebuffer geometry, or UlanziStudio integration must be tested on a real D200 — note this in the PR description.
