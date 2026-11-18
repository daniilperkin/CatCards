/**
 * Simple 2-grade spaced repetition (know / don't know).
 *
 * - New card answered "know"      → due in 1 day.
 * - Review card answered "know"   → interval × ease (ease grows slightly).
 * - Any card answered "don't know"→ due in 10 minutes, interval reset, ease drops.
 * - A card counts as "mastered" once its interval reaches 21 days.
 */

export const DAY = 24 * 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
export const MASTERED_DAYS = 21;
const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

export interface SrsState {
  /** Epoch ms when the card is due next. 0 = new card (due now). */
  due: number;
  /** Current interval in days (0 = new / relearning). */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Result of the most recent answer, if any. */
  last: 'know' | 'dontKnow' | null;
}

export type Grade = 'know' | 'dontKnow';

export function newSrs(): SrsState {
  return { due: 0, interval: 0, ease: START_EASE, reps: 0, lapses: 0, last: null };
}

export function review(s: SrsState, grade: Grade, now: number): SrsState {
  if (grade === 'dontKnow') {
    return {
      due: now + 10 * MINUTE,
      interval: 0,
      ease: Math.max(MIN_EASE, s.ease - 0.2),
      reps: s.reps + 1,
      lapses: s.reps > 0 ? s.lapses + 1 : s.lapses,
      last: 'dontKnow',
    };
  }
  if (s.interval >= 1 && now < s.due) {
    const scheduledMs = s.interval * DAY;
    const elapsedMs = Math.max(0, scheduledMs - (s.due - now));
    const ratio = Math.min(1, elapsedMs / scheduledMs);
    if (ratio < 0.5) {
      return {
        due: now + s.interval * DAY,
        interval: s.interval,
        ease: s.ease,
        reps: s.reps + 1,
        lapses: s.lapses,
        last: 'know',
      };
    }
    const scaledInterval = Math.max(s.interval + 1, Math.round(s.interval * (1 + (s.ease - 1) * ratio)));
    return {
      due: now + scaledInterval * DAY,
      interval: scaledInterval,
      ease: Math.min(MAX_EASE, s.ease + 0.05 * ratio),
      reps: s.reps + 1,
      lapses: s.lapses,
      last: 'know',
    };
  }
  const interval = s.interval < 1 ? 1 : Math.max(s.interval + 1, Math.round(s.interval * s.ease));
  return {
    due: now + interval * DAY,
    interval,
    ease: Math.min(MAX_EASE, s.ease + 0.05),
    reps: s.reps + 1,
    lapses: s.lapses,
    last: 'know',
  };
}

export const isDue = (s: SrsState, now: number) => s.due <= now;
export const isNew = (s: SrsState) => s.reps === 0;
export const isMastered = (s: SrsState) => s.interval >= MASTERED_DAYS;
export const isUnknown = (s: SrsState) => s.last === 'dontKnow';
