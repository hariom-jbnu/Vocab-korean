import { describe, expect, it } from 'vitest';
import { buildDailyQueue, pickNext, seededShuffle } from './queue';
import { newCard, Rating, State, type ReviewRecord, type WordCard } from './srs';

const now = new Date(2026, 10, 10, 15, 0);
const ids = ['가', '나', '다', '라', '마', '바', '사', '아'];

function reviewCard(id: string, due: Date): WordCard {
  return { ...newCard(id, now), state: State.Review, due, stability: 5, reps: 3 };
}

function record(wordId: string, state: State, review = now): ReviewRecord {
  return { wordId, rating: Rating.Good, state, review, due: review, stability: 1, difficulty: 5, scheduled_days: 0, learning_steps: 0 };
}

describe('buildDailyQueue', () => {
  it('puts due reviews first, oldest due first, and skips reviews due tomorrow', () => {
    const cards = new Map<string, WordCard>([
      ['가', reviewCard('가', new Date(2026, 10, 10, 12, 0))],
      ['나', reviewCard('나', new Date(2026, 10, 8, 9, 0))],
      ['다', reviewCard('다', new Date(2026, 10, 10, 23, 0))],
      ['라', reviewCard('라', new Date(2026, 10, 11, 9, 0))],
    ]);
    const q = buildDailyQueue(ids, cards, [], now, { newPerDay: 0, seed: 1 });
    expect(q.reviews).toEqual(['나', '가', '다']);
    expect(q.newWords).toEqual([]);
  });

  it('adds new words up to the daily limit minus the ones already started today', () => {
    const cards = new Map<string, WordCard>([['가', { ...newCard('가', now), state: State.Learning }]]);
    const q = buildDailyQueue(ids, cards, [record('가', State.New)], now, { newPerDay: 3, seed: 7 });
    expect(q.newDoneToday).toBe(1);
    expect(q.newWords).toHaveLength(2);
    expect(q.newWords).not.toContain('가');
  });

  it('ignores answers from earlier study days', () => {
    const yesterday = new Date(2026, 10, 9, 15, 0);
    const q = buildDailyQueue(ids, new Map(), [record('가', State.New, yesterday)], now, { newPerDay: 2, seed: 7 });
    expect(q.newDoneToday).toBe(0);
    expect(q.answeredToday).toBe(0);
    expect(q.newWords).toHaveLength(2);
  });

  it('pauses new words when too many reviews are due', () => {
    const cards = new Map(ids.map((id) => [id, reviewCard(id, new Date(2026, 10, 9))] as const));
    const q = buildDailyQueue([...ids, '자'], cards, [], now, { newPerDay: 5, seed: 1, pauseNewAbove: 3 });
    expect(q.reviews).toHaveLength(8);
    expect(q.newWords).toEqual([]);
  });

  it('keeps the same new-word order for the same seed', () => {
    const a = buildDailyQueue(ids, new Map(), [], now, { newPerDay: 5, seed: 42 }).newWords;
    const b = buildDailyQueue(ids, new Map(), [], now, { newPerDay: 5, seed: 42 }).newWords;
    expect(a).toEqual(b);
  });
});

describe('pickNext', () => {
  it('prefers due learning cards, then the queue, then learning ahead', () => {
    const soon = new Date(now.getTime() + 5 * 60_000);
    const past = new Date(now.getTime() - 60_000);
    expect(pickNext(['가'], new Map([['나', past]]), now)).toBe('나');
    expect(pickNext(['가'], new Map([['나', soon]]), now)).toBe('가');
    expect(pickNext([], new Map([['나', soon]]), now)).toBe('나');
    expect(pickNext([], new Map(), now)).toBeUndefined();
  });
});

describe('seededShuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const input = [...ids];
    const out = seededShuffle(input, 3);
    expect(input).toEqual(ids);
    expect([...out].sort()).toEqual([...ids].sort());
    expect(out).not.toEqual(ids);
  });
});
