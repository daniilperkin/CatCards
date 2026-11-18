import { describe, expect, it } from 'vitest';
import { DAY, isMastered, MINUTE, newSrs, review } from './srs';

const NOW = 1_700_000_000_000;

describe('srs', () => {
  it('new card answered know is due in 1 day', () => {
    const s = review(newSrs(), 'know', NOW);
    expect(s.interval).toBe(1);
    expect(s.due).toBe(NOW + DAY);
    expect(s.last).toBe('know');
  });

  it('intervals grow with repeated due know answers', () => {
    let s = newSrs();
    let t = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = review(s, 'know', t);
      intervals.push(s.interval);
      t = s.due;
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    expect(isMastered(s)).toBe(true);
  });

  it('early review on the same day does not inflate interval or ease', () => {
    const s1 = review(newSrs(), 'know', NOW);
    expect(s1.interval).toBe(1);
    const s2 = review(s1, 'know', NOW + 5 * MINUTE);
    expect(s2.interval).toBe(1);
    expect(s2.ease).toBe(s1.ease);
    expect(s2.due).toBe(NOW + 5 * MINUTE + DAY);
  });

  it("don't know resets interval, lowers ease, due in 10 min", () => {
    let s = review(review(newSrs(), 'know', NOW), 'know', NOW);
    const ease = s.ease;
    s = review(s, 'dontKnow', NOW);
    expect(s.interval).toBe(0);
    expect(s.due).toBe(NOW + 10 * MINUTE);
    expect(s.ease).toBeLessThan(ease);
    expect(s.lapses).toBe(1);
    expect(s.last).toBe('dontKnow');
  });

  it('ease never drops below 1.3', () => {
    let s = newSrs();
    for (let i = 0; i < 30; i++) s = review(s, 'dontKnow', NOW);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
  });
});
