# AGENTS.md — CatCards

Mobile-first flash card PWA (Android Chrome target). User creates own cards (photo/text front, text/photo back), studies by tap-to-flip + swipe right (know) / left (don't know), 2-grade spaced repetition.

## Layout

- `src/lib/` — pure logic + storage: `srs.ts` (scheduling), `session.ts` (study queue/undo/stats), `db.ts` (Dexie schema: `decks`, `cards`, `images` Blobs), `backup.ts` (zip export/import), `stats.ts`, `router.ts` (hash router for GitHub Pages), `i18n.tsx` (de + uk strings).
- `src/screens/` — `Home`, `DeckView`, `CardEditor`, `Study`, `Settings`.
- `src/components/` — `SwipeCard` (pointer-event swipe + 3D flip), `DeckForm`, `ui.tsx` (Header, Button, icons).
- `public/` — icons (generated from `icon.svg` via `pnpm exec pwa-assets-generator --preset minimal-2023 public/icon.svg`).

## Rules

- Offline-only by design: no network calls, no accounts, no analytics. Data lives in IndexedDB; backup is a zip (`data.json` + `images/<id>`). Bump `BACKUP_VERSION` and handle old formats when the schema changes; add a Dexie `version(n)` migration, never edit version 1.
- Photos are stored at original size (owner decision); do not add downscaling without asking.
- Every UI string goes through `i18n.tsx` and needs both `de` and `uk` (TypeScript enforces the keys).
- Base path is `/CatCards/` (GitHub Pages); `BASE=/` env overrides it.
- UTF-8 without BOM; Biome formatting (single quotes, 120 cols).

## Verify

`pnpm verify` = `tsc -b` + `biome check .` + `vitest run` + `vite build`. Run it before every commit.

## Git

Plain English imperative commit messages; stage specific files (never `git add -A` / `git add .`). Public repo `daniilperkin/CatCards`; push only when asked.
