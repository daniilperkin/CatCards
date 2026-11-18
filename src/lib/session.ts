/**
 * Pure study-session state machine. The UI persists SRS changes separately;
 * this only manages queue order, re-queuing of "don't know" cards, undo and stats.
 */
import type { Grade } from './srs';

export interface SessionState {
  queue: string[];
  /** Card IDs that were answered "know" on their first appearance this session. */
  firstTryKnown: string[];
  /** Card IDs that were answered "don't know" at least once this session. */
  missed: string[];
  /** Total number of distinct cards in the session. */
  total: number;
  history: { queue: string[]; firstTryKnown: string[]; missed: string[]; cardId: string }[];
}

/** How many positions later a missed card reappears. */
export const REQUEUE_GAP = 3;

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startSession(ids: string[]): SessionState {
  return { queue: [...ids], firstTryKnown: [], missed: [], total: ids.length, history: [] };
}

export function answer(s: SessionState, grade: Grade): SessionState {
  const [cardId, ...rest] = s.queue;
  if (!cardId) return s;
  const snapshot = { queue: s.queue, firstTryKnown: s.firstTryKnown, missed: s.missed, cardId };
  const wasMissed = s.missed.includes(cardId);
  let queue = rest;
  let { firstTryKnown, missed } = s;
  if (grade === 'know') {
    if (!wasMissed) firstTryKnown = [...firstTryKnown, cardId];
  } else {
    if (!wasMissed) missed = [...missed, cardId];
    const pos = Math.min(REQUEUE_GAP, rest.length);
    queue = [...rest.slice(0, pos), cardId, ...rest.slice(pos)];
  }
  return { ...s, queue, firstTryKnown, missed, history: [...s.history, snapshot] };
}

export function undo(s: SessionState): { state: SessionState; cardId: string | null } {
  const last = s.history.at(-1);
  if (!last) return { state: s, cardId: null };
  return {
    state: {
      ...s,
      queue: last.queue,
      firstTryKnown: last.firstTryKnown,
      missed: last.missed,
      history: s.history.slice(0, -1),
    },
    cardId: last.cardId,
  };
}

export const isDone = (s: SessionState) => s.queue.length === 0;
