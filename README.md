# CatCards 😺

Mobile-first flash card PWA: create your own cards with photos, tap to flip, swipe **right = know**, **left = don't know**. Spaced repetition decides when a card comes back.

- Offline, no account: everything is stored in the browser (IndexedDB) on your phone; photos are kept full-size.
- Card front: photo and/or text. Back: text and/or photo. You can take photos with the camera or pick them from the gallery.
- Decks, per-deck progress (% mastered), "Alle fälligen lernen" (study all due cards) across decks.
- Study options: shuffle, reverse mode, undo, study only "don't know" cards, session stats.
- UI in German and Ukrainian; card text can be in any language (Cyrillic, umlauts …).
- Backup: export/import a `.zip` (data + photos). On Android, export opens the share sheet.

## Use on the phone

1. Open the GitHub Pages URL in Chrome on Android.
2. Menu → **Zum Startbildschirm hinzufügen / Install app**.
3. It now works offline like a normal app.

## Develop

```powershell
pnpm install
pnpm dev        # http://localhost:5173/CatCards/ (also on LAN via --host)
pnpm verify     # typecheck + lint + test + build
```

Camera capture and PWA install need HTTPS (or `localhost`), so test those on the deployed Pages URL.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Dexie (IndexedDB) · fflate (zip backup) · vite-plugin-pwa · Vitest · Biome.

## Spaced repetition

Two grades only:

- **Know**: a new card comes back in 1 day; after that the interval is multiplied by its ease (starts at 2.5).
- **Don't know**: the card comes back in 10 minutes and is re-queued 3 cards later in the current session.

A card counts as mastered once its interval reaches 21 days. Logic: `src/lib/srs.ts`.

## Deploy

Every push to `main` triggers `.github/workflows/pages.yml`, which runs `pnpm verify` and deploys `dist/` to GitHub Pages (base path `/CatCards/`).
