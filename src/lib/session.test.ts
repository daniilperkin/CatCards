import { describe, expect, it } from 'vitest';
import { answer, isDone, REQUEUE_GAP, shuffle, startSession, undo } from './session';

describe('session', () => {
  it('know removes the card; session ends when queue empty', () => {
    let s = startSession(['a', 'b']);
    s = answer(s, 'know');
    s = answer(s, 'know');
    expect(isDone(s)).toBe(true);
    expect(s.firstTryKnown).toEqual(['a', 'b']);
    expect(s.missed).toEqual([]);
  });

  it("don't know re-queues the card a few positions later", () => {
    let s = startSession(['a', 'b', 'c', 'd', 'e']);
    s = answer(s, 'dontKnow');
    expect(s.queue.indexOf('a')).toBe(REQUEUE_GAP);
    expect(s.missed).toEqual(['a']);
  });

  it('missed card known later is not counted as first-try', () => {
    let s = startSession(['a']);
    s = answer(s, 'dontKnow');
    expect(s.queue).toEqual(['a']);
    s = answer(s, 'know');
    expect(isDone(s)).toBe(true);
    expect(s.firstTryKnown).toEqual([]);
    expect(s.missed).toEqual(['a']);
  });

  it('undo restores previous state and reports card', () => {
    const s0 = startSession(['a', 'b']);
    const s1 = answer(s0, 'dontKnow');
    const { state, cardId } = undo(s1);
    expect(cardId).toBe('a');
    expect(state.queue).toEqual(['a', 'b']);
    expect(state.missed).toEqual([]);
    expect(undo(state).cardId).toBeNull();
  });

  it('shuffle keeps all items', () => {
    const items = Array.from({ length: 50 }, (_, i) => String(i));
    expect(shuffle(items).sort()).toEqual([...items].sort());
  });
});
