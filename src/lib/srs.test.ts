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

  it('intervals grow with repeated know answers', () => {
    let s = newSrs();
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = review(s, 'know', NOW);
      intervals.push(s.interval);
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
    expect(isMastered(s)).toBe(true);
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
