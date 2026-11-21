import { describe, expect, it } from 'vitest';
import {
  buildQuestion,
  chooseRound,
  gradeChoice,
  gradeTyped,
  lookAlike,
  meaningLines,
  meaningRelation,
  meanings,
  MISSING_CHANCE,
  pickDistractors,
  wordKind,
} from './quiz';
import { newCard, Rating, State } from './srs';
import type { VocabItem } from '../types';

const w = (ko: string, en: string, hi = ko, extra: Partial<VocabItem> = {}): VocabItem => ({ id: ko, ko, en, hi, ...extra });

const pool = [
  w('가방', 'bag', 'थैला'),
  w('가게', 'store, shop', 'दुकान'),
  w('사과', 'apple; apology', 'सेब; माफ़ी'),
  w('나무', 'tree', 'पेड़'),
  w('책', 'book', 'किताब'),
  w('서점', 'bookstore', 'किताबों की दुकान'),
  w('책방', 'bookstore', 'किताबों की दुकान'),
  w('먹다', 'to eat', 'खाना'),
  w('마시다', 'to drink', 'पीना'),
  w('자다', 'to sleep', 'सोना'),
  w('학교', 'school', 'विद्यालय'),
  w('학생', 'student', 'छात्र'),
  w('물', 'water', 'पानी'),
  w('예쁘다', 'to be pretty', 'सुंदर होना'),
  w('크다', 'big', 'बड़ा'),
  w('셔츠', 'shirt', 'कमीज़', { topic: 'Clothes' }),
  w('바지', 'trousers', 'पतलून', { topic: 'Clothes' }),
  w('치마', 'skirt', 'स्कर्ट', { topic: 'Clothes' }),
  w('양말', 'socks', 'मोज़े', { topic: 'Clothes' }),
  w('누나', 'older sister (said by a male)', 'बड़ी बहन (लड़के के लिए)'),
  w('언니', 'older sister (said by a female)', 'बड़ी बहन (लड़की के लिए)'),
  w('눈', 'snow', 'बर्फ़'),
  { id: '눈#2', ko: '눈', en: 'eye', hi: 'आँख' },
];
const byId = (id: string) => pool.find((x) => x.id === id)!;

/** A repeating "random" source for tests. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('meanings and how glosses relate', () => {
  it('splits at top-level commas only and drops notes in brackets', () => {
    expect(meanings('store, shop; eggplant')).toEqual(['store', 'shop', 'eggplant']);
    expect(meanings('to put on (shoes, socks)')).toEqual(['to put on']);
  });

  it('tells synonyms from meanings that differ only in a note', () => {
    expect(meaningRelation('store, shop', 'shop')).toBe('same');
    expect(meaningRelation('bookstore', 'bookstore')).toBe('same');
    expect(meaningRelation('older sister (said by a male)', 'older sister (said by a female)')).toBe('nuance');
    expect(meaningRelation('tree', 'water')).toBe('none');
  });

  it('knows nouns, verbs and adjectives', () => {
    expect(wordKind(byId('물'))).toBe('noun');
    expect(wordKind(byId('먹다'))).toBe('verb');
    expect(wordKind(byId('예쁘다'))).toBe('adjective');
    expect(wordKind(byId('크다'))).toBe('adjective');
  });

  it('scores look-alike Korean higher', () => {
    expect(lookAlike('학교', '학생')).toBeGreaterThan(lookAlike('학교', '나무'));
  });
});

describe('pickDistractors', () => {
  it('never offers the answer, a synonym, the same Hindi or the same spelling', () => {
    for (let i = 0; i < 30; i++) {
      const ids = pickDistractors(byId('서점'), pool, { count: 6 }).map((p) => p.id);
      expect(ids).not.toContain('서점');
      expect(ids).not.toContain('책방'); // also "bookstore"
      const eye = pickDistractors(byId('눈'), pool, { count: 8 }).map((p) => p.id);
      expect(eye).not.toContain('눈#2'); // 눈 also means eye: two right answers
    }
  });

  it('prefers words the learner has already studied', () => {
    const studied = new Set(['나무', '학생', '셔츠']);
    for (let i = 0; i < 20; i++) {
      const picks = pickDistractors(byId('물'), pool, { count: 3, studied }).map((p) => p.id);
      expect(picks.sort()).toEqual(['나무', '셔츠', '학생']);
    }
  });

  it('prefers the same topic and kind of word', () => {
    const picks = pickDistractors(byId('셔츠'), pool, { count: 3, random: seq(0.5) }).map((p) => p.id);
    expect(picks.sort()).toEqual(['바지', '양말', '치마']);
    const verbs = pickDistractors(byId('먹다'), pool, { count: 2, random: seq(0.5) });
    expect(verbs.every((p) => wordKind(p) === 'verb')).toBe(true);
  });

  it('offers look-alike Korean when the options show Korean', () => {
    const picks = pickDistractors(byId('학교'), pool, { count: 1, show: 'korean', random: seq(0.5) });
    expect(picks[0].id).toBe('학생');
  });

  it('allows a nuance trap: the same meaning told apart by its note', () => {
    const picks = pickDistractors(byId('누나'), pool, { count: 1, random: seq(0.5) });
    expect(picks[0].id).toBe('언니');
  });

  it('skips recently used options, and falls back to them when nothing else is left', () => {
    const avoid = new Set(['바지', '치마', '양말']);
    const fresh = pickDistractors(byId('셔츠'), pool, { count: 3, avoid, random: seq(0.5) }).map((p) => p.id);
    expect(fresh.some((id) => avoid.has(id))).toBe(false);
    const tiny = [byId('셔츠'), byId('바지'), byId('치마'), byId('양말')];
    expect(pickDistractors(byId('셔츠'), tiny, { count: 3, avoid })).toHaveLength(3);
  });

  it('does not repeat a wrong option within five questions of the same word', () => {
    const history: string[][] = [];
    for (let i = 0; i < 12; i++) {
      const avoid = new Set(history.slice(-5).flat());
      const picks = pickDistractors(byId('물'), pool, { count: 3, avoid }).map((p) => p.id);
      for (const id of picks) expect(avoid.has(id)).toBe(false);
      history.push(picks);
    }
  });
});

describe('buildQuestion', () => {
  it('shows the answer once among four options', () => {
    const q = buildQuestion(byId('나무'), pool);
    expect(q.answerShown).toBe(true);
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((c) => c.id === '나무')).toHaveLength(1);
  });

  it('leaves the answer out about one time in five, only when allowed', () => {
    let missing = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      const q = buildQuestion(byId('나무'), pool, { allowMissing: true });
      expect(q.options).toHaveLength(4);
      if (!q.answerShown) {
        missing++;
        expect(q.options.map((o) => o.id)).not.toContain('나무');
      }
    }
    expect(missing / runs).toBeGreaterThan(MISSING_CHANCE - 0.05);
    expect(missing / runs).toBeLessThan(MISSING_CHANCE + 0.05);
    for (let i = 0; i < 50; i++) expect(buildQuestion(byId('나무'), pool).answerShown).toBe(true);
  });
});

describe('chooseRound', () => {
  const now = new Date();
  const review = (stability: number, reps = 0) => ({ ...newCard('가', now), state: State.Review, stability, reps });
  const all = { canListen: true, canType: true, hasSound: true };

  it('asks Korean to meaning while a word is new, learning or under 2 days', () => {
    expect(chooseRound(undefined, all)).toEqual({ exercise: 'choice', phase: 'recognition' });
    expect(chooseRound({ ...newCard('가', now), state: State.Learning, stability: 30 }, all).exercise).toBe('choice');
    expect(chooseRound(review(1.5), all).exercise).toBe('choice');
  });

  it('rotates meaning to Korean, listening and Korean to meaning from 2 to 7 days', () => {
    expect([3, 4, 5].map((reps) => chooseRound(review(4, reps), all).exercise)).toEqual(['reverse', 'listen', 'choice']);
    expect(chooseRound(review(4, 4), all).phase).toBe('recognition');
  });

  it('falls back to reading the sound, or to meaning to Korean, without a Korean voice', () => {
    expect(chooseRound(review(4, 4), { canListen: false, canType: true, hasSound: true }).exercise).toBe('listen');
    expect(chooseRound(review(4, 4), { canListen: false, canType: true, hasSound: false }).exercise).toBe('reverse');
  });

  it('asks for the Korean word from 7 days', () => {
    expect(chooseRound(review(7), all)).toEqual({ exercise: 'type', phase: 'production' });
    expect(chooseRound(review(30), { ...all, canType: false })).toEqual({ exercise: 'reverse', phase: 'production' });
  });
});

describe('grading', () => {
  it('gives Again for anything but a right pick, Hard when slow, else Good, never Easy', () => {
    expect(gradeChoice({ outcome: 'wrong', recallMs: 1000, chooseMs: 1000 })).toBe(Rating.Again);
    expect(gradeChoice({ outcome: 'dontKnow', recallMs: 1000, chooseMs: 0 })).toBe(Rating.Again);
    expect(gradeChoice({ outcome: 'right', recallMs: 7000, chooseMs: 1000 })).toBe(Rating.Hard);
    expect(gradeChoice({ outcome: 'right', recallMs: 1000, chooseMs: 9000 })).toBe(Rating.Hard);
    expect(gradeChoice({ outcome: 'right', recallMs: 1500, chooseMs: 2000 })).toBe(Rating.Good);
    expect(gradeChoice({ outcome: 'right', chooseMs: 2000 })).toBe(Rating.Good);
  });

  it('rewards quick exact typing with Easy and is lenient on one-letter slips', () => {
    expect(gradeTyped({ correct: false, nearMiss: false }, 3000)).toBe(Rating.Again);
    expect(gradeTyped({ correct: false, nearMiss: true }, 3000)).toBe(Rating.Hard);
    expect(gradeTyped({ correct: true, nearMiss: false }, 3000)).toBe(Rating.Easy);
    expect(gradeTyped({ correct: true, nearMiss: false }, 9000)).toBe(Rating.Good);
    expect(gradeTyped({ correct: true, nearMiss: false }, 20000)).toBe(Rating.Hard);
  });
});

describe('meaningLines', () => {
  it('shows both meanings when the learner hid both', () => {
    expect(meaningLines(pool[0], { ko: true, en: false, hi: false })).toEqual({ en: 'bag', hi: 'थैला' });
    expect(meaningLines(pool[0], { ko: true, en: true, hi: false })).toEqual({ en: 'bag', hi: undefined });
  });
});
