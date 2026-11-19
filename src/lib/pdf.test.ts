import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CatCardsDB, uid } from './db';
import {
  A4_HEIGHT,
  A4_WIDTH,
  buildPdfFilename,
  cardGridSlot,
  exportDeckPdf,
  type PdfLabels,
  parseHexColor,
  sanitizePdfText,
  wrapText,
} from './pdf';
import { newSrs } from './srs';

const FONTS_DIR = path.resolve(process.cwd(), 'src/assets/fonts');
const loadLocalFonts = async () => ({
  regular: new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, 'NotoSans-Regular.ttf'))),
  bold: new Uint8Array(fs.readFileSync(path.join(FONTS_DIR, 'NotoSans-Bold.ttf'))),
});

// Minimal valid 1×1 red PNG
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
  0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const LABELS_DE: PdfLabels = {
  front: 'Vorderseite',
  back: 'Rückseite',
  cards: 'Karten',
  fronts: 'Vorderseiten',
  backs: 'Rückseiten',
};

describe('pdf', () => {
  it('sanitizes unsupported symbols and emojis cleanly while preserving supported scripts', () => {
    const ascii = new Set<number>();
    for (let c = 32; c <= 126; c++) ascii.add(c);
    // Add German ä and Ukrainian Ї
    ascii.add('ä'.codePointAt(0) as number);
    ascii.add('Ї'.codePointAt(0) as number);

    expect(sanitizePdfText('Katze 😺 → ä ≤ Ї\r\nOK ✓', ascii)).toBe('Katze  -> ä <= Ї\nOK [x]');
  });

  it('wraps paragraphs, preserves blank lines, and breaks overlong words', () => {
    const mono = (s: string) => s.length * 10;
    expect(wrapText('hello world\n\nfoo bar baz', 80, mono)).toEqual(['hello', 'world', '', 'foo bar', 'baz']);
    expect(wrapText('superlongunbreakableword', 60, mono)).toEqual(['superl', 'ongunb', 'reakab', 'leword']);
  });

  it('mirrors printable card grid columns on back pages for duplex printing', () => {
    expect(cardGridSlot(0, 'front')).toEqual({ row: 0, col: 0 });
    expect(cardGridSlot(0, 'back')).toEqual({ row: 0, col: 1 });
    expect(cardGridSlot(1, 'front')).toEqual({ row: 0, col: 1 });
    expect(cardGridSlot(1, 'back')).toEqual({ row: 0, col: 0 });
    expect(cardGridSlot(7, 'front')).toEqual({ row: 3, col: 1 });
    expect(cardGridSlot(7, 'back')).toEqual({ row: 3, col: 0 });
  });

  it('parses deck hex colors and builds clean localized PDF filenames', () => {
    expect(parseHexColor('#ec4899')).toEqual(parseHexColor('invalid'));
    const d = new Date('2026-11-19T12:00:00Z');
    expect(buildPdfFilename('Біологія & Chemie!', 'sheet', d)).toBe('біологія-chemie-2026-11-19.pdf');
    expect(buildPdfFilename('Biologie', 'cards', d)).toBe('biologie-cards-2026-11-19.pdf');
  });

  it('generates a valid multi-page A4 Study Sheet PDF with German, Ukrainian, emojis, and embedded photos', async () => {
    const db = new CatCardsDB(`pdf-sheet-${uid()}`);
    await db.decks.add({ id: 'd1', name: 'Біологія & Chemie 😺', color: '#10b981', createdAt: 1 });
    await db.images.add({ id: 'img1', blob: new Blob([TINY_PNG], { type: 'image/png' }) });

    // Create 10 varied cards (photo+text, image-only, long multi-line text, Cyrillic+German+math)
    for (let i = 0; i < 10; i++) {
      await db.cards.add({
        id: `c${i}`,
        deckId: 'd1',
        frontText: i === 1 ? '' : `Frage #${i + 1}: Їжак & Straße → α² ≤ 5`,
        frontImageId: i % 3 === 0 || i === 1 ? 'img1' : null,
        backText: `Відповідь #${i + 1}: «необовʼязково» — Größe €${i + 1} ₴100 🎉\n`.repeat(i === 2 ? 12 : 2),
        backImageId: i === 0 ? 'img1' : null,
        createdAt: i + 1,
        updatedAt: i + 1,
        srs: newSrs(),
      });
    }

    const blob = await exportDeckPdf('d1', {
      layout: 'sheet',
      labels: LABELS_DE,
      date: new Date('2026-11-19T12:00:00Z'),
      db,
      loadFonts: loadLocalFonts,
      prepareImage: async (b) => ({ bytes: new Uint8Array(await b.arrayBuffer()), format: 'png' }),
    });

    expect(blob.type).toBe('application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2);
    const { width, height } = parsed.getPage(0).getSize();
    expect(width).toBeCloseTo(A4_WIDTH, 1);
    expect(height).toBeCloseTo(A4_HEIGHT, 1);
  });

  it('generates paired Front/Back A4 pages for Printable Flashcards (2×4 grid)', async () => {
    const db = new CatCardsDB(`pdf-cards-${uid()}`);
    await db.decks.add({ id: 'd1', name: 'Vokabeln Українська', color: '#ec4899', createdAt: 1 });
    await db.images.add({ id: 'img1', blob: new Blob([TINY_PNG], { type: 'image/png' }) });

    // 9 cards => 2 sheets => 4 pages (Front 1, Back 1, Front 2, Back 2)
    for (let i = 0; i < 9; i++) {
      await db.cards.add({
        id: `c${i}`,
        deckId: 'd1',
        frontText: `Begriff ${i + 1} (äöüß)`,
        frontImageId: i === 0 ? 'img1' : null,
        backText: `Переклад ${i + 1}: Їжак, ґанок, єнот`,
        backImageId: i === 1 ? 'img1' : null,
        createdAt: i + 1,
        updatedAt: i + 1,
        srs: newSrs(),
      });
    }

    const blob = await exportDeckPdf('d1', {
      layout: 'cards',
      labels: LABELS_DE,
      db,
      loadFonts: loadLocalFonts,
      prepareImage: async (b) => ({ bytes: new Uint8Array(await b.arrayBuffer()), format: 'png' }),
    });

    const parsed = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(parsed.getPageCount()).toBe(4);
  });

  it('rejects exporting an empty or missing deck', async () => {
    const db = new CatCardsDB(`pdf-empty-${uid()}`);
    await db.decks.add({ id: 'empty', name: 'Leer', color: '#ec4899', createdAt: 1 });

    await expect(
      exportDeckPdf('empty', { layout: 'sheet', labels: LABELS_DE, db, loadFonts: loadLocalFonts }),
    ).rejects.toThrow('Deck has no cards');
    await expect(
      exportDeckPdf('missing', { layout: 'sheet', labels: LABELS_DE, db, loadFonts: loadLocalFonts }),
    ).rejects.toThrow('Deck not found');
  });
});
