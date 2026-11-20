import { describe, expect, it } from 'vitest';
import type { VocabItem } from '../types';
import {
  buildSchedule,
  dayNumber,
  interleave,
  planDate,
  planWordIds,
  REVIEW_OFFSETS,
  todaysNewTarget,
  wordsOnDay,
  type StudyPlan,
} from './plan';

const word = (id: string, source: 'image' | 'common'): VocabItem => ({ id, ko: id, hi: '', en: '', source });
const images = Array.from({ length: 30 }, (_, i) => word(`img${i}`, 'image'));
const common = Array.from({ length: 70 }, (_, i) => word(`com${i}`, 'common'));
const all = [...images, ...common];
const isImg = (id: string) => id.startsWith('img');

describe('interleave', () => {
  it('spreads the shorter list evenly and keeps each order', () => {
    expect(interleave<string | number>(['a', 'b'], [1, 2, 3, 4, 5, 6])).toEqual([1, 'a', 2, 3, 4, 'b', 5, 6]);
    expect(interleave([], [1, 2])).toEqual([1, 2]);
  });
});

describe('planWordIds', () => {
  it('takes every word once when the plan covers the whole list', () => {
    const ids = planWordIds(all, 100, 'mixed', 7);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
  });

  it('mixed keeps the share of image words and spreads them through the plan', () => {
    const ids = planWordIds(all, 50, 'mixed', 7);
    expect(ids.filter(isImg)).toHaveLength(15);
    // Every block of ten words holds some image words.
    for (let i = 0; i < 50; i += 10) expect(ids.slice(i, i + 10).some(isImg)).toBe(true);
  });

  it('images first puts all image words before common words', () => {
    const ids = planWordIds(all, 40, 'images', 7);
    expect(ids.slice(0, 30).every(isImg)).toBe(true);
    expect(ids.slice(30).some(isImg)).toBe(false);
  });

  it('common first fills with common words and adds image words only when needed', () => {
    expect(planWordIds(all, 70, 'common', 7).some(isImg)).toBe(false);
    expect(planWordIds(all, 80, 'common', 7).filter(isImg)).toHaveLength(10);
  });

  it('is stable for a seed and different across seeds', () => {
    expect(planWordIds(all, 50, 'mixed', 3)).toEqual(planWordIds(all, 50, 'mixed', 3));
    expect(planWordIds(all, 50, 'mixed', 3)).not.toEqual(planWordIds(all, 50, 'mixed', 4));
  });

  it('caps the plan at the size of the word list', () => {
    expect(planWordIds(all, 5000, 'mixed', 1)).toHaveLength(100);
  });
});

describe('wordsOnDay', () => {
  it('splits 2000 words over 30 days into 66s and 67s that add up', () => {
    const counts = Array.from({ length: 30 }, (_, i) => wordsOnDay(2000, 30, i + 1));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(Math.min(...counts)).toBe(66);
    expect(Math.max(...counts)).toBe(67);
    expect(wordsOnDay(2000, 30, 31)).toBe(0);
  });
});

describe('buildSchedule', () => {
  it('gives each day its words in order, and reviews only from earlier days', () => {
    const ids = planWordIds(all, 100, 'mixed', 1);
    const s = buildSchedule(ids, 10, '2026-11-20');
    expect(s).toHaveLength(10);
    expect(s.flatMap((d) => d.wordIds)).toEqual(ids);
    expect(s[0].reviews).toBe(0);
    expect(s[1].reviews).toBeGreaterThan(0);
    expect(s[0].date.getDate()).toBe(20);
    expect(s[9].date.getDate()).toBe(29);
  });

  it('counts reviews from each offset that falls inside the plan', () => {
    const s = buildSchedule(Array.from({ length: 30 }, (_, i) => `w${i}`), 30, '2026-11-20');
    // Day 31 is past the plan, so only the offsets before it count on the last day.
    const hits = REVIEW_OFFSETS.filter((o) => o <= 29).length;
    expect(s[29].reviews).toBe(Math.round(hits * 1.1));
  });
});

describe('dayNumber and planDate', () => {
  it('counts study days from the start, with the 4 a.m. rollover', () => {
    expect(dayNumber('2026-11-20', new Date(2026, 10, 20, 9))).toBe(1);
    expect(dayNumber('2026-11-20', new Date(2026, 10, 21, 2))).toBe(1);
    expect(dayNumber('2026-11-20', new Date(2026, 10, 21, 5))).toBe(2);
    expect(dayNumber('2026-11-20', new Date(2026, 10, 19, 12))).toBe(0);
    expect(dayNumber('2026-11-20', new Date(2026, 11, 19, 12))).toBe(30);
  });

  it('dates across a month end', () => {
    const d = planDate('2026-11-20', 30);
    expect([d.getMonth(), d.getDate()]).toEqual([11, 19]);
  });
});

describe('todaysNewTarget', () => {
  const plan: StudyPlan = { totalWords: 2000, days: 30, order: 'mixed', startDay: '2026-11-20' };
  const day = (n: number) => new Date(2026, 10, 19 + n, 12);

  it('starts at the planned pace', () => {
    expect(todaysNewTarget(plan, 2000, 0, 0, day(1))).toBe(67);
  });

  it('does not change during the day as words are learned', () => {
    expect(todaysNewTarget(plan, 2000, 40, 40, day(1))).toBe(67);
  });

  it('shares missed words over the days left', () => {
    // Nothing done on days 1 and 2: 2000 words over 28 days.
    expect(todaysNewTarget(plan, 2000, 0, 0, day(3))).toBe(72);
  });

  it('gets lighter after working ahead', () => {
    expect(todaysNewTarget(plan, 2000, 400, 0, day(3))).toBe(58);
  });

  it('never asks for more than twice the pace, and nothing before the start', () => {
    expect(todaysNewTarget(plan, 2000, 0, 0, day(29))).toBe(134);
    expect(todaysNewTarget(plan, 2000, 0, 0, day(0))).toBe(0);
    expect(todaysNewTarget(plan, 2000, 2000, 0, day(10))).toBe(0);
  });
});
