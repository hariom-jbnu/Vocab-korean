import { describe, expect, it } from 'vitest';
import { dailyActivity, forecast, hardestWords, stageCounts, stageOf, trueRetention } from './stats';
import { newCard, Rating, State, type ReviewRecord, type WordCard } from './srs';

const now = new Date(2026, 10, 10, 15, 0);

const card = (id: string, patch: Partial<WordCard>): WordCard => ({ ...newCard(id, now), ...patch });
const review = (stability: number, due = now) => ({ state: State.Review, stability, due });

const rec = (rating: Rating, state: State, review: Date): ReviewRecord => ({
  wordId: 'x',
  rating: rating as ReviewRecord['rating'],
  state,
  review,
  due: review,
  stability: 1,
  difficulty: 5,
  scheduled_days: 0,
  learning_steps: 0,
});

describe('stageOf', () => {
  it('names stages from FSRS stability', () => {
    expect(stageOf(undefined)).toBe('new');
    expect(stageOf(card('a', { state: State.Learning, stability: 2 }))).toBe('learning');
    expect(stageOf(card('a', review(3)))).toBe('young');
    expect(stageOf(card('a', review(10)))).toBe('familiar');
    expect(stageOf(card('a', review(30)))).toBe('known');
    expect(stageOf(card('a', review(200)))).toBe('mastered');
  });

  it('counts every word once', () => {
    const cards = new Map([['a', card('a', review(30))]]);
    const counts = stageCounts(['a', 'b', 'c'], cards);
    expect(counts).toMatchObject({ new: 2, known: 1 });
  });
});

describe('trueRetention', () => {
  it('ignores new and learning answers', () => {
    const since = new Date(2026, 10, 1);
    const reviews = [
      rec(Rating.Good, State.Review, now),
      rec(Rating.Again, State.Review, now),
      rec(Rating.Hard, State.Review, now),
      rec(Rating.Again, State.New, now),
      rec(Rating.Again, State.Review, new Date(2026, 9, 1)),
    ];
    const r = trueRetention(reviews, since);
    expect(r.count).toBe(3);
    expect(r.rate).toBeCloseTo(2 / 3);
    expect(trueRetention([], since).rate).toBeNull();
  });
});

describe('forecast', () => {
  it('buckets due cards by study day, with overdue cards today', () => {
    const cards = [
      card('a', review(5, new Date(2026, 10, 1))),
      card('b', review(5, new Date(2026, 10, 10, 20))),
      card('c', review(5, new Date(2026, 10, 11, 9))),
      card('d', review(5, new Date(2026, 11, 30))),
      card('e', {}),
    ];
    expect(forecast(cards, now, 3)).toEqual([2, 1, 0]);
  });
});

describe('dailyActivity', () => {
  it('counts answers per day, oldest first', () => {
    const reviews = [
      rec(Rating.Good, State.Review, now),
      rec(Rating.Good, State.Review, new Date(2026, 10, 10, 2)), // before 4 a.m.: previous day
      rec(Rating.Good, State.Review, new Date(2026, 9, 1)),
    ];
    const days = dailyActivity(reviews, now, 3);
    expect(days.map((d) => d.day)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(days.map((d) => d.count)).toEqual([0, 1, 1]);
  });
});

describe('hardestWords', () => {
  it('puts the most-forgotten words first', () => {
    const list = hardestWords([
      card('a', { ...review(5), lapses: 1, difficulty: 6 }),
      card('b', { ...review(5), lapses: 3, difficulty: 5 }),
      card('c', { ...review(5), lapses: 0, difficulty: 4 }),
    ]);
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
  });
});
