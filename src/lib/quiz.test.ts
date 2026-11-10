import { describe, expect, it } from 'vitest';
import { buildChoices, gradeChoice, meaningLines, meanings, pickDistractors } from './quiz';
import { Rating } from './srs';
import type { VocabItem } from '../types';

const w = (ko: string, en: string, hi = ko): VocabItem => ({ id: ko, ko, en, hi });

const pool = [
  w('가방', 'bag', 'थैला'),
  w('가게', 'store, shop', 'दुकान'),
  w('사과', 'apple; apology', 'सेब; माफ़ी'),
  w('나무', 'tree', 'पेड़'),
  w('책', 'book', 'किताब'),
  w('서점', 'bookstore', 'किताबों की दुकान'),
  w('책방', 'bookstore', 'किताबों की दुकान'),
  w('먹다', 'eat', 'खाना'),
  w('마시다', 'drink', 'पीना'),
  w('자다', 'sleep', 'सोना'),
  w('학교', 'school', 'विद्यालय'),
  w('물', 'water', 'पानी'),
];

// Deterministic "random" for tests
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('meanings', () => {
  it('splits on commas and semicolons and drops notes in brackets', () => {
    expect(meanings('store, shop; eggplant')).toEqual(['store', 'shop', 'eggplant']);
    expect(meanings('close ~ (eyes)')).toEqual(['close']);
  });
});

describe('pickDistractors', () => {
  it('never returns the answer, a word with the same first syllable, or a synonym', () => {
    for (let i = 0; i < 20; i++) {
      const picks = pickDistractors(pool[0], pool, 3);
      expect(picks).toHaveLength(3);
      for (const p of picks) {
        expect(p.id).not.toBe('가방');
        expect(p.ko[0]).not.toBe('가');
      }
    }
    const forBookstore = pickDistractors(pool[5], pool, 5);
    expect(forBookstore.map((p) => p.id)).not.toContain('책방');
  });

  it('prefers the same kind of word', () => {
    const picks = pickDistractors(pool[7], pool, 2, seq(0.5));
    expect(picks.every((p) => p.ko.endsWith('다'))).toBe(true);
  });

  it('does not offer two options with the same meaning', () => {
    const picks = pickDistractors(w('나', 'I', 'मैं'), pool, 10);
    const firsts = picks.map((p) => meanings(p.en)[0]);
    expect(new Set(firsts).size).toBe(firsts.length);
  });
});

describe('buildChoices', () => {
  it('contains the answer exactly once among four options', () => {
    const choices = buildChoices(pool[3], pool);
    expect(choices).toHaveLength(4);
    expect(choices.filter((c) => c.id === '나무')).toHaveLength(1);
  });
});

describe('gradeChoice', () => {
  it('maps wrong, slow and quick answers to Again, Hard and Good', () => {
    expect(gradeChoice(false, 1000)).toBe(Rating.Again);
    expect(gradeChoice(true, 12000)).toBe(Rating.Hard);
    expect(gradeChoice(true, 2000)).toBe(Rating.Good);
  });
});

describe('meaningLines', () => {
  it('shows both meanings when the learner hid both', () => {
    expect(meaningLines(pool[0], { ko: true, en: false, hi: false })).toEqual({ en: 'bag', hi: 'थैला' });
    expect(meaningLines(pool[0], { ko: true, en: true, hi: false })).toEqual({ en: 'bag', hi: undefined });
  });
});
