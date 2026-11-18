import { strFromU8, strToU8, unzip, zip } from 'fflate';
import { type Card, type CatCardsDB, type Deck, db as defaultDb } from './db';

/**
 * Backup format (.catcards.zip):
 *   data.json            { format, version, exportedAt, decks, cards, images: [{id, type, file}] }
 *   images/<id>          original image bytes
 */
export const BACKUP_FORMAT = 'catcards-backup';
export const BACKUP_VERSION = 1;

interface BackupJson {
  format: string;
  version: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  images: { id: string; type: string; file: string }[];
}

export async function exportBackup(db: CatCardsDB = defaultDb, deckId?: string): Promise<Blob> {
  const [decks, cards] = deckId
    ? await Promise.all([
        db.decks.where('id').equals(deckId).toArray(),
        db.cards.where('deckId').equals(deckId).toArray(),
      ])
    : await Promise.all([db.decks.toArray(), db.cards.toArray()]);
  const referencedImageIds = new Set(
    cards.flatMap((c) => [c.frontImageId, c.backImageId]).filter((x): x is string => !!x),
  );
  const allImages = deckId
    ? (await db.images.bulkGet([...referencedImageIds])).filter((x): x is { id: string; blob: Blob } => !!x)
    : await db.images.toArray();
  const files: Record<string, Uint8Array> = {};
  const imageMeta: BackupJson['images'] = [];
  for (const img of allImages) {
    const file = `images/${img.id}`;
    files[file] = new Uint8Array(await img.blob.arrayBuffer());
    imageMeta.push({ id: img.id, type: img.blob.type, file });
  }
  const json: BackupJson = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    decks,
    cards,
    images: imageMeta,
  };
  files['data.json'] = strToU8(JSON.stringify(json));
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    // images are already compressed; level 0 keeps export fast
    zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data))),
  );
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}

export async function shareOrDownloadBackup(
  deckId?: string,
  prefix = 'catcards',
  db: CatCardsDB = defaultDb,
): Promise<void> {
  const blob = await exportBackup(db, deckId);
  const date = new Date().toISOString().slice(0, 10);
  const safePrefix =
    prefix
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'catcards';
  const name = `${safePrefix}-${date}.zip`;
  const file = new File([blob], name, { type: 'application/zip' });
  // Prefer the Android share sheet (save to Drive, Files, Telegram …); fall back to download.
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export interface ImportResult {
  decks: number;
  cards: number;
  images: number;
}

/**
 * Imports a backup. `replace` wipes all existing data first; otherwise items are
 * merged (same IDs overwrite, so re-importing the same backup is idempotent).
 */
export async function importBackup(
  file: Blob,
  mode: 'merge' | 'replace',
  db: CatCardsDB = defaultDb,
): Promise<ImportResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(buf, (err, data) => (err ? reject(err) : resolve(data))),
  );
  const raw = files['data.json'];
  if (!raw) throw new Error('data.json missing');
  const json = JSON.parse(strFromU8(raw)) as BackupJson;
  if (json.format !== BACKUP_FORMAT) throw new Error('not a CatCards backup');
  if (json.version > BACKUP_VERSION) throw new Error('backup from a newer app version');
  if (!Array.isArray(json.decks) || !Array.isArray(json.cards) || !Array.isArray(json.images)) {
    throw new Error('invalid backup structure');
  }

  const images = json.images.map((m) => {
    const bytes = files[m.file];
    if (!bytes) throw new Error(`missing ${m.file}`);
    return { id: m.id, blob: new Blob([bytes as BlobPart], { type: m.type }) };
  });

  await db.transaction('rw', db.decks, db.cards, db.images, async () => {
    if (mode === 'replace') {
      await Promise.all([db.decks.clear(), db.cards.clear(), db.images.clear()]);
    }
    await db.images.bulkPut(images);
    await db.decks.bulkPut(json.decks);
    await db.cards.bulkPut(json.cards);
    if (mode === 'merge') {
      const allCards = await db.cards.toArray();
      const usedImages = new Set(
        allCards.flatMap((c) => [c.frontImageId, c.backImageId]).filter((x): x is string => !!x),
      );
      const allImageKeys = await db.images.toCollection().primaryKeys();
      const orphanIds = allImageKeys.filter((id) => !usedImages.has(id));
      if (orphanIds.length > 0) await db.images.bulkDelete(orphanIds);
    }
  });
  return { decks: json.decks.length, cards: json.cards.length, images: images.length };
}
