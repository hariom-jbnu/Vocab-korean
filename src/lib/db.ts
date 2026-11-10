import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReviewRecord, WordCard } from './srs';

/**
 * Learning progress lives in IndexedDB because the review log grows with
 * every answer. One record per word holds its FSRS state, and an
 * append-only log holds every answer.
 */
interface ProgressDB extends DBSchema {
  cards: {
    key: string;
    value: WordCard;
  };
  reviews: {
    key: number;
    value: ReviewRecord;
    indexes: { review: Date; wordId: string };
  };
}

const DB_NAME = 'vocab-progress';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ProgressDB>> | null = null;

function db(): Promise<IDBPDatabase<ProgressDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ProgressDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('cards', { keyPath: 'id' });
        const reviews = database.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        reviews.createIndex('review', 'review');
        reviews.createIndex('wordId', 'wordId');
      },
    });
  }
  return dbPromise;
}

export async function getAllCards(): Promise<Map<string, WordCard>> {
  const cards = await (await db()).getAll('cards');
  return new Map(cards.map((c) => [c.id, c]));
}

export async function getCard(id: string): Promise<WordCard | undefined> {
  return (await db()).get('cards', id);
}

/** Save a card's new state and its review record in one transaction. */
export async function saveAnswer(card: WordCard, record: ReviewRecord): Promise<number> {
  const tx = (await db()).transaction(['cards', 'reviews'], 'readwrite');
  const [, key] = await Promise.all([
    tx.objectStore('cards').put(card),
    tx.objectStore('reviews').add(record),
    tx.done,
  ]);
  return key;
}

/** Undo an answer: restore the previous card (or remove it) and drop the record. */
export async function undoAnswer(previous: WordCard | undefined, wordId: string, recordId: number): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews'], 'readwrite');
  await Promise.all([
    previous ? tx.objectStore('cards').put(previous) : tx.objectStore('cards').delete(wordId),
    tx.objectStore('reviews').delete(recordId),
    tx.done,
  ]);
}

export async function getReviewsSince(since: Date): Promise<ReviewRecord[]> {
  return (await db()).getAllFromIndex('reviews', 'review', IDBKeyRange.lowerBound(since));
}

export async function getAllReviews(): Promise<ReviewRecord[]> {
  return (await db()).getAll('reviews');
}

export async function clearProgress(): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews'], 'readwrite');
  await Promise.all([tx.objectStore('cards').clear(), tx.objectStore('reviews').clear(), tx.done]);
}

/** Close the connection (used by tests to start from a fresh database). */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
