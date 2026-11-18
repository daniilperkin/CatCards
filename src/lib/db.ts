import Dexie, { type EntityTable } from 'dexie';
import { newSrs, type SrsState } from './srs';

export interface Deck {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  frontText: string;
  frontImageId: string | null;
  backText: string;
  backImageId: string | null;
  createdAt: number;
  updatedAt: number;
  srs: SrsState;
}

/** Photos are stored as original, full-size Blobs in their own table. */
export interface ImageRow {
  id: string;
  blob: Blob;
}

export class CatCardsDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  images!: EntityTable<ImageRow, 'id'>;

  constructor(name = 'catcards') {
    super(name);
    this.version(1).stores({
      decks: 'id, createdAt',
      cards: 'id, deckId, createdAt, srs.due',
      images: 'id',
    });
  }
}

export const db = new CatCardsDB();

export const uid = () => crypto.randomUUID();

export const DECK_COLORS = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#84cc16'];

export async function createDeck(name: string, color: string): Promise<string> {
  const id = uid();
  await db.decks.add({ id, name: name.trim(), color, createdAt: Date.now() });
  return id;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.images, async () => {
    const cards = await db.cards.where('deckId').equals(deckId).toArray();
    const imageIds = cards.flatMap((c) => [c.frontImageId, c.backImageId]).filter((x): x is string => !!x);
    await db.images.bulkDelete(imageIds);
    await db.cards.bulkDelete(cards.map((c) => c.id));
    await db.decks.delete(deckId);
  });
}

export async function saveImage(blob: Blob): Promise<string> {
  const id = uid();
  await db.images.add({ id, blob });
  return id;
}

export interface CardInput {
  frontText: string;
  frontImage: Blob | null | undefined; // undefined = keep, null = remove
  backText: string;
  backImage: Blob | null | undefined;
}

export async function upsertCard(deckId: string, cardId: string | null, input: CardInput): Promise<string> {
  return db.transaction('rw', db.cards, db.images, async () => {
    const now = Date.now();
    const existing = cardId ? await db.cards.get(cardId) : undefined;
    const resolveImage = async (current: string | null, next: Blob | null | undefined) => {
      if (next === undefined) return current;
      if (current) await db.images.delete(current);
      return next ? saveImage(next) : null;
    };
    const frontImageId = await resolveImage(existing?.frontImageId ?? null, input.frontImage);
    const backImageId = await resolveImage(existing?.backImageId ?? null, input.backImage);
    const card: Card = {
      id: existing?.id ?? uid(),
      deckId,
      frontText: input.frontText,
      backText: input.backText,
      frontImageId,
      backImageId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      srs: existing?.srs ?? newSrs(),
    };
    await db.cards.put(card);
    return card.id;
  });
}

export async function deleteCard(cardId: string): Promise<void> {
  await db.transaction('rw', db.cards, db.images, async () => {
    const c = await db.cards.get(cardId);
    if (!c) return;
    await db.images.bulkDelete([c.frontImageId, c.backImageId].filter((x): x is string => !!x));
    await db.cards.delete(cardId);
  });
}

export async function resetDeckProgress(deckId: string): Promise<void> {
  await db.cards.where('deckId').equals(deckId).modify({ srs: newSrs() });
}
