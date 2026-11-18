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

export async function exportBackup(db: CatCardsDB = defaultDb): Promise<Blob> {
  const [decks, cards, images] = await Promise.all([db.decks.toArray(), db.cards.toArray(), db.images.toArray()]);
  const files: Record<string, Uint8Array> = {};
  const imageMeta: BackupJson['images'] = [];
  for (const img of images) {
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
  });
  return { decks: json.decks.length, cards: json.cards.length, images: images.length };
}
