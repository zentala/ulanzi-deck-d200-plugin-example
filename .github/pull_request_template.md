## What & why

<!-- Short description: what changed, why. Link the issue if any. -->

## Checklist

- [ ] `pnpm test` green (Plugin SDK demo)
- [ ] `pnpm lint && pnpm typecheck && pnpm format:check` green
- [ ] `pytest` green (USB demo, if touched)
- [ ] If an action's `render()` changed: `pnpm previews` re-run and `assets/previews/*.png` committed (the pre-commit hook does this automatically)
- [ ] If a new action: `manifest.json`, `plugin/uuids.js`, `plugin/types.d.ts`, `plugin/app.js`, `plugin/app.html`, `eslint.config.mjs`, and `tests/dispatcher.test.js` all updated
- [ ] BACKLOG.md updated (mark done items, file new ones surfaced during the work)
- [ ] README updated if user-visible behaviour changed

## Manual verification

<!-- If you tested on a real D200, mention it here. Otherwise note that this is unit-test verified only. -->
