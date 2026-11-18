import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { CatCardsDB, uid } from './db';
import { newSrs } from './srs';

describe('backup', () => {
  it('round-trips decks, cards (incl. Cyrillic) and image bytes', async () => {
    const a = new CatCardsDB(`a-${uid()}`);
    const imgBytes = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    await a.images.add({ id: 'img1', blob: new Blob([imgBytes], { type: 'image/jpeg' }) });
    await a.decks.add({ id: 'd1', name: 'Тварини', color: '#f59e0b', createdAt: 1 });
    await a.cards.add({
      id: 'c1',
      deckId: 'd1',
      frontText: '',
      frontImageId: 'img1',
      backText: 'Кіт – Katze ä ö ü ß',
      backImageId: null,
      createdAt: 1,
      updatedAt: 1,
      srs: newSrs(),
    });

    const zip = await exportBackup(a);

    const b = new CatCardsDB(`b-${uid()}`);
    await b.decks.add({ id: 'old', name: 'old', color: '#000', createdAt: 0 });
    const r = await importBackup(zip, 'replace', b);
    expect(r).toEqual({ decks: 1, cards: 1, images: 1 });
    expect(await b.decks.get('old')).toBeUndefined();
    expect((await b.decks.get('d1'))?.name).toBe('Тварини');
    expect((await b.cards.get('c1'))?.backText).toBe('Кіт – Katze ä ö ü ß');
    const img = await b.images.get('img1');
    expect(img?.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await (img as { blob: Blob }).blob.arrayBuffer())).toEqual(imgBytes);

    // merge is idempotent
    await importBackup(zip, 'merge', b);
    expect(await b.cards.count()).toBe(1);
  });

  it('rejects non-backup zips', async () => {
    const b = new CatCardsDB(`c-${uid()}`);
    await expect(importBackup(new Blob([new Uint8Array([1, 2, 3])]), 'merge', b)).rejects.toThrow();
  });
});
