import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearProgress,
  closeDb,
  countPending,
  getAllCards,
  getAllReviews,
  getDeletedReviewIds,
  getPendingCards,
  getPendingReviews,
  getReviewsSince,
  markCardsSynced,
  markReviewsSynced,
  mergeRemote,
  PROGRESS_EVENT,
  progressSource,
  saveAnswer,
  undoAnswer,
} from './db';
import { createScheduler, newCard, rate, Rating, State } from './srs';

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

    // Undoing a new word's first answer leaves an unstarted card, so the undo syncs too.
    await undoAnswer(undefined, '가방', firstId);
    const back = (await getAllCards()).get('가방');
    expect(back).toMatchObject({ state: State.New, reps: 0, pending: 1 });
    expect(await getAllReviews()).toEqual([]);
  });

  it('marks answers for upload with a shared id', async () => {
    const s = createScheduler();
    const { card, record } = rate(s, newCard('가방', now), Rating.Good, now);
    await saveAnswer(card, record);
    const [saved] = await getAllReviews();
    expect(saved.uid).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.pending).toBe(1);
    expect((await getPendingCards()).map((c) => c.id)).toEqual(['가방']);
    expect((await getAllCards()).get('가방')?.updatedAt).toBeGreaterThan(0);
  });

  it('remembers undone answers so sync can delete them remotely', async () => {
    const s = createScheduler();
    const a = rate(s, newCard('가방', now), Rating.Good, now);
    const id = await saveAnswer(a.card, a.record);
    const [saved] = await getAllReviews();
    await undoAnswer(undefined, '가방', id);
    expect(await getDeletedReviewIds()).toEqual([saved.uid]);
  });

  it('clears the pending mark only when the card did not change again', async () => {
    const s = createScheduler();
    const a = rate(s, newCard('가방', now), Rating.Good, now);
    await saveAnswer(a.card, a.record);
    const [sent] = await getPendingCards();
    await markCardsSynced([{ ...sent, updatedAt: (sent.updatedAt ?? 0) - 1 }]);
    expect(await getPendingCards()).toHaveLength(1);
    await markCardsSynced([sent]);
    expect(await getPendingCards()).toHaveLength(0);
    const [review] = await getPendingReviews();
    await markReviewsSynced([review.uid!]);
    expect(await getPendingReviews()).toHaveLength(0);
    expect(await countPending()).toBe(0);
  });
});

describe('merging progress from other devices', () => {
  const s = createScheduler();

  it('takes newer cards, keeps newer local ones and adds each answer once', async () => {
    const local = rate(s, newCard('가방', now), Rating.Good, now);
    await saveAnswer(local.card, local.record);
    const localCard = (await getAllCards()).get('가방')!;
    const [localReview] = await getAllReviews();

    const older = { ...rate(s, newCard('가방', now), Rating.Again, now).card, updatedAt: localCard.updatedAt! - 1000 };
    const remoteNew = { ...rate(s, newCard('나무', now), Rating.Easy, now).card, updatedAt: 5 };
    const remoteAnswer = { ...rate(s, newCard('나무', now), Rating.Easy, now).record, uid: '11111111-1111-4111-8111-111111111111' };

    const changed = await mergeRemote([older, remoteNew, remoteNew], [remoteAnswer, remoteAnswer, { ...localReview, id: undefined }]);
    expect(changed).toBe(2);

    const cards = await getAllCards();
    expect(cards.get('가방')?.updatedAt).toBe(localCard.updatedAt);
    expect(cards.get('나무')).toMatchObject({ updatedAt: 5 });
    expect(cards.get('나무')?.pending).toBeUndefined();
    const reviews = await getAllReviews();
    expect(reviews.map((r) => r.wordId).sort()).toEqual(['가방', '나무']);
    expect(reviews.find((r) => r.wordId === '나무')?.pending).toBeUndefined();
  });

  it('does not bring back an answer that was undone here', async () => {
    const a = rate(s, newCard('가방', now), Rating.Good, now);
    const id = await saveAnswer(a.card, a.record);
    const [saved] = await getAllReviews();
    await undoAnswer(undefined, '가방', id);
    expect(await mergeRemote([], [saved])).toBe(0);
    expect(await getAllReviews()).toEqual([]);
  });

  it('tells listeners the change came from another device', async () => {
    // Tests run in Node: stand in a plain event target for window.
    vi.stubGlobal('window', new EventTarget());
    const sources: string[] = [];
    const listen = (e: Event) => sources.push(progressSource(e));
    window.addEventListener(PROGRESS_EVENT, listen);
    const a = rate(s, newCard('가방', now), Rating.Good, now);
    await saveAnswer(a.card, a.record);
    await mergeRemote([{ ...a.card, id: '나무', updatedAt: 1 }], []);
    window.removeEventListener(PROGRESS_EVENT, listen);
    vi.unstubAllGlobals();
    expect(sources).toEqual(['local', 'remote']);
  });
});

describe('upgrading a database from before sync', () => {
  it('gives old answers shared ids and marks old progress for upload', async () => {
    await clearProgress();
    await closeDb();
    await deleteDB('vocab-progress');
    const v1 = await openDB('vocab-progress', 1, {
      upgrade(database) {
        database.createObjectStore('cards', { keyPath: 'id' });
        const reviews = database.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        reviews.createIndex('review', 'review');
        reviews.createIndex('wordId', 'wordId');
      },
    });
    const s = createScheduler();
    const a = rate(s, newCard('가방', now), Rating.Good, now);
    await v1.put('cards', a.card);
    await v1.add('reviews', a.record);
    await v1.add('reviews', a.record);
    v1.close();

    const reviews = await getAllReviews();
    expect(reviews).toHaveLength(2);
    expect(new Set(reviews.map((r) => r.uid)).size).toBe(2);
    expect(reviews.every((r) => r.pending === 1)).toBe(true);
    const [card] = await getPendingCards();
    expect(card.updatedAt).toBe(a.card.last_review!.getTime());
  });
});
