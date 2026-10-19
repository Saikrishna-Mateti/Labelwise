# Labelwise conventions

Full product brief: `docs/brief.md`. Read it before starting a milestone.

## Rules

- `src/scoring/` is pure TypeScript: no React, Expo, network or storage imports. Deterministic, unit-tested.
- Every scoring method implements `ScoringMethod` and returns `{ method, value, band, source, missingInputs, reasons }`.
- Never invent nutrition thresholds, scoring tables, unit conversions or additive data. If a source is unreachable, stop and ask.
- Missing input is reported in `missingInputs`, never silently treated as zero.
- OFF data is ODbL: attribute it wherever shown; keep user-entered data in its own SQLite table.
- OFF API is read-only, always with the custom `User-Agent`. No scraping, no write endpoints.
- No backend, accounts, analytics or ads.
- Routes live in `app/` only (every file there is a screen). Tests and non-route code go in `src/`.

## Before saying "done"

```sh
npm run typecheck && npm run lint && npm test
```

Then launch in the simulator (`npx expo run:ios`).

## Expo

- SDK 58. APIs change each SDK; check `https://docs.expo.dev/versions/v58.0.0/` rather than memory.
- Add packages with `npx expo install <pkg>` (SDK-compatible versions), then pin the exact version in `package.json`.
- `ios/` and `android/` are generated (gitignored). Configure native behaviour via `app.json` and config plugins.
- TypeScript 6 defaults `types` to `[]`; add global type packages to `tsconfig.json` `types` explicitly.

## Git

Small commits, clear messages. One branch per milestone (`milestone-N`).
