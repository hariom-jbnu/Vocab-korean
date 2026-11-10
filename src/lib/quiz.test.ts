import { describe, expect, it } from 'vitest';
import { buildChoices, chooseExercise, gradeChoice, gradeTyped, meaningLines, meanings, pickDistractors } from './quiz';
import { newCard, Rating, State } from './srs';
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

describe('chooseExercise', () => {
  const now = new Date();
  const review = (stability: number) => ({ ...newCard('가', now), state: State.Review, stability });

  const all = { canListen: true, canType: true };

  it('starts new and learning words with multiple choice', () => {
    expect(chooseExercise(undefined, all)).toBe('choice');
    expect(chooseExercise({ ...newCard('가', now), state: State.Learning, stability: 30 }, all)).toBe('choice');
  });

  it('moves stable words to the listening round when audio is available', () => {
    expect(chooseExercise(review(1), all)).toBe('choice');
    expect(chooseExercise(review(5), all)).toBe('listen');
    expect(chooseExercise(review(5), { canListen: false, canType: true })).toBe('choice');
  });

  it('moves well-known words to typing unless typing is turned off', () => {
    expect(chooseExercise(review(30), all)).toBe('type');
    expect(chooseExercise(review(30), { canListen: true, canType: false })).toBe('listen');
  });
});

describe('gradeTyped', () => {
  it('rewards quick exact answers and is lenient on one-letter slips', () => {
    expect(gradeTyped({ correct: false, nearMiss: false }, 3000)).toBe(Rating.Again);
    expect(gradeTyped({ correct: false, nearMiss: true }, 3000)).toBe(Rating.Hard);
    expect(gradeTyped({ correct: true, nearMiss: false }, 3000)).toBe(Rating.Easy);
    expect(gradeTyped({ correct: true, nearMiss: false }, 9000)).toBe(Rating.Good);
    expect(gradeTyped({ correct: true, nearMiss: false }, 20000)).toBe(Rating.Hard);
  });
});
