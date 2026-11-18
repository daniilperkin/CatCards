import type { Card } from './db';
import type { StudyMode } from './router';
import { isDue, isMastered, isNew, isUnknown } from './srs';

export interface DeckStats {
  total: number;
  due: number;
  fresh: number;
  mastered: number;
  unknown: number;
  progress: number;
}

export function deckStats(cards: Card[], now = Date.now()): DeckStats {
  let due = 0;
  let fresh = 0;
  let mastered = 0;
  let unknown = 0;
  for (const c of cards) {
    if (isDue(c.srs, now)) due++;
    if (isNew(c.srs)) fresh++;
    if (isMastered(c.srs)) mastered++;
    if (isUnknown(c.srs)) unknown++;
  }
  return { total: cards.length, due, fresh, mastered, unknown, progress: cards.length ? mastered / cards.length : 0 };
}

/** Cards for a study mode, in default order (most overdue first; new cards last). */
export function selectCards(cards: Card[], mode: StudyMode, now = Date.now()): Card[] {
  const pick =
    mode === 'due'
      ? cards.filter((c) => isDue(c.srs, now))
      : mode === 'unknown'
        ? cards.filter((c) => isUnknown(c.srs))
        : [...cards];
  return pick.sort((a, b) => {
    const an = isNew(a.srs) ? 1 : 0;
    const bn = isNew(b.srs) ? 1 : 0;
    if (an !== bn) return an - bn;
    return a.srs.due - b.srs.due || a.createdAt - b.createdAt;
  });
}
