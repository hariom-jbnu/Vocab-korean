import { describe, expect, it } from 'vitest';
import { answersPerDay, computeStreak } from './streak';
import { studyDayKey } from './day';

const today = new Date(2026, 10, 10, 15, 0);
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};
/** Build a day map: each entry is [daysAgo, answers]. */
const history = (...days: [number, number][]) => new Map(days.map(([n, c]) => [studyDayKey(daysAgo(n)), c]));

describe('computeStreak', () => {
  it('counts consecutive days with enough answers', () => {
    const s = computeStreak(history([0, 10], [1, 6], [2, 20]), today);
    expect(s).toEqual({ current: 3, todayCounts: true, frozen: [] });
  });

  it('keeps yesterday\'s streak alive until today ends', () => {
    const s = computeStreak(history([1, 10], [2, 10]), today);
    expect(s.current).toBe(2);
    expect(s.todayCounts).toBe(false);
  });

  it('does not count days with too few answers', () => {
    expect(computeStreak(history([0, 3], [1, 2]), today).current).toBe(0);
  });

  it('forgives one missed day per week', () => {
    const s = computeStreak(history([0, 5], [1, 5], [3, 5], [4, 5]), today);
    expect(s.current).toBe(4);
    expect(s.frozen).toEqual([studyDayKey(daysAgo(2))]);
  });

  it('breaks on a second miss within the same week', () => {
    const s = computeStreak(history([0, 5], [2, 5], [4, 5]), today);
    expect(s.current).toBe(2);
  });

  it('breaks on two missed days in a row', () => {
    expect(computeStreak(history([0, 5], [3, 5]), today).current).toBe(1);
  });
});

describe('answersPerDay', () => {
  it('groups review times by study day', () => {
    const m = answersPerDay([today, today, new Date(2026, 10, 11, 2, 0), daysAgo(1)]);
    expect(m.get('2026-11-10')).toBe(3);
    expect(m.get('2026-11-09')).toBe(1);
  });
});
