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

  it('exports a single deck and cleans up orphaned images on merge', async () => {
    const a = new CatCardsDB(`deck-export-${uid()}`);
    await a.images.bulkAdd([
      { id: 'img1', blob: new Blob([new Uint8Array([1])], { type: 'image/png' }) },
      { id: 'img2', blob: new Blob([new Uint8Array([2])], { type: 'image/png' }) },
    ]);
    await a.decks.bulkAdd([
      { id: 'd1', name: 'Deck 1', color: '#f59e0b', createdAt: 1 },
      { id: 'd2', name: 'Deck 2', color: '#ef4444', createdAt: 2 },
    ]);
    await a.cards.bulkAdd([
      {
        id: 'c1',
        deckId: 'd1',
        frontText: 'F1',
        frontImageId: 'img1',
        backText: 'B1',
        backImageId: null,
        createdAt: 1,
        updatedAt: 1,
        srs: newSrs(),
      },
      {
        id: 'c2',
        deckId: 'd2',
        frontText: 'F2',
        frontImageId: 'img2',
        backText: 'B2',
        backImageId: null,
        createdAt: 2,
        updatedAt: 2,
        srs: newSrs(),
      },
    ]);

    const singleZip = await exportBackup(a, 'd1');
    const target = new CatCardsDB(`target-${uid()}`);
    await target.images.add({ id: 'img-old', blob: new Blob([new Uint8Array([9])], { type: 'image/png' }) });
    await target.decks.add({ id: 'd1', name: 'Deck 1', color: '#f59e0b', createdAt: 1 });
    await target.cards.add({
      id: 'c1',
      deckId: 'd1',
      frontText: 'Old',
      frontImageId: 'img-old',
      backText: 'Old',
      backImageId: null,
      createdAt: 1,
      updatedAt: 1,
      srs: newSrs(),
    });

    const r = await importBackup(singleZip, 'merge', target);
    expect(r).toEqual({ decks: 1, cards: 1, images: 1 });
    expect(await target.decks.count()).toBe(1);
    expect(await target.images.get('img-old')).toBeUndefined();
    expect(await target.images.get('img1')).toBeDefined();
  });

  it('rejects non-backup zips', async () => {
    const b = new CatCardsDB(`c-${uid()}`);
    await expect(importBackup(new Blob([new Uint8Array([1, 2, 3])]), 'merge', b)).rejects.toThrow();
  });
});
