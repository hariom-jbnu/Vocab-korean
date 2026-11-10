import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearProgress, closeDb, getAllCards, getAllReviews, getReviewsSince, saveAnswer, undoAnswer } from './db';
import { createScheduler, newCard, rate, Rating } from './srs';

const now = new Date('2026-11-10T10:00:00Z');

afterEach(async () => {
  await clearProgress();
  await closeDb();
});

describe('progress db', () => {
  it('saves a card and its review record together', async () => {
    const s = createScheduler();
    const { card, record } = rate(s, newCard('가방', now), Rating.Good, now, 1500);
    const id = await saveAnswer(card, record);

    const cards = await getAllCards();
    expect(cards.get('가방')?.state).toBe(card.state);
    expect(cards.get('가방')?.due).toBeInstanceOf(Date);

    const reviews = await getAllReviews();
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ id, wordId: '가방', rating: Rating.Good, durationMs: 1500 });
  });

  it('finds reviews since a time', async () => {
    const s = createScheduler();
    const old = new Date('2026-11-01T10:00:00Z');
    const a = rate(s, newCard('가', old), Rating.Good, old);
    const b = rate(s, newCard('나', now), Rating.Good, now);
    await saveAnswer(a.card, a.record);
    await saveAnswer(b.card, b.record);
    const since = await getReviewsSince(new Date('2026-11-10T00:00:00Z'));
    expect(since.map((r) => r.wordId)).toEqual(['나']);
  });

  it('undoes an answer', async () => {
    const s = createScheduler();
    const first = rate(s, newCard('가방', now), Rating.Good, now);
    const firstId = await saveAnswer(first.card, first.record);
    const later = new Date(now.getTime() + 10 * 60_000);
    const second = rate(s, first.card, Rating.Again, later);
    const secondId = await saveAnswer(second.card, second.record);

    await undoAnswer(first.card, '가방', secondId);
    expect((await getAllCards()).get('가방')?.reps).toBe(first.card.reps);
    expect((await getAllReviews()).map((r) => r.id)).toEqual([firstId]);

    await undoAnswer(undefined, '가방', firstId);
    expect((await getAllCards()).size).toBe(0);
    expect(await getAllReviews()).toEqual([]);
  });
});
