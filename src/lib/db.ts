import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { newCard, type ReviewRecord, type WordCard } from './srs';

/**
 * Learning progress lives in IndexedDB because the review log grows with
 * every answer. One record per word holds its FSRS state, and an
 * append-only log holds every answer.
 *
 * This is the working copy. When the learner is signed in, sync uploads
 * changes marked `pending` and merges in changes from other devices.
 */
interface ProgressDB extends DBSchema {
  cards: {
    key: string;
    value: WordCard;
    indexes: { pending: number };
  };
  reviews: {
    key: number;
    value: ReviewRecord;
    indexes: { review: Date; wordId: string; uid: string; pending: number };
  };
  /** Ids of uploaded answers that were undone here and must be deleted remotely. */
  deleted: {
    key: string;
    value: { uid: string };
  };
}

const DB_NAME = 'vocab-progress';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ProgressDB>> | null = null;

/** Fired on window after progress changes, so headers and stats can refresh. */
export const PROGRESS_EVENT = 'vocab:progress';

/** Where a progress change came from: an answer here, or a sync from another device. */
export type ProgressSource = 'local' | 'remote';

function notifyProgress(source: ProgressSource = 'local'): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { source } }));
}

/** The source of a PROGRESS_EVENT. */
export function progressSource(event: Event): ProgressSource {
  return (event as CustomEvent<{ source?: ProgressSource }>).detail?.source ?? 'local';
}

export function newUid(): string {
  return crypto.randomUUID();
}

let lastStamp = 0;

/** Change time for a card: the clock, but never the same value twice, so two quick changes still order. */
function stamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

function db(): Promise<IDBPDatabase<ProgressDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ProgressDB>(DB_NAME, DB_VERSION, {
      async upgrade(database, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          database.createObjectStore('cards', { keyPath: 'id' });
          const reviews = database.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
          reviews.createIndex('review', 'review');
          reviews.createIndex('wordId', 'wordId');
        }
        if (oldVersion < 2) {
          // Sync: give every answer a shared id and mark existing progress
          // for upload, so it is kept when the learner first signs in.
          const cards = tx.objectStore('cards');
          const reviews = tx.objectStore('reviews');
          cards.createIndex('pending', 'pending');
          reviews.createIndex('uid', 'uid', { unique: true });
          reviews.createIndex('pending', 'pending');
          database.createObjectStore('deleted', { keyPath: 'uid' });

          for (let c = await cards.openCursor(); c; c = await c.continue()) {
            const card = c.value;
            await c.update({ ...card, updatedAt: card.updatedAt ?? card.last_review?.getTime() ?? 0, pending: 1 });
          }
          for (let c = await reviews.openCursor(); c; c = await c.continue()) {
            await c.update({ ...c.value, uid: c.value.uid ?? newUid(), pending: 1 });
          }
        }
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
    tx.objectStore('cards').put({ ...card, updatedAt: stamp(), pending: 1 }),
    tx.objectStore('reviews').add({ ...record, uid: record.uid ?? newUid(), pending: 1 }),
    tx.done,
  ]);
  notifyProgress();
  return key;
}

/**
 * Undo an answer: restore the previous card and drop the record. A word that
 * was new goes back to an unstarted card rather than being removed, so the
 * undo also reaches other devices.
 */
export async function undoAnswer(previous: WordCard | undefined, wordId: string, recordId: number): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews', 'deleted'], 'readwrite');
  const reviews = tx.objectStore('reviews');
  const record = await reviews.get(recordId);
  const restored = previous ?? newCard(wordId, new Date());
  await Promise.all([
    tx.objectStore('cards').put({ ...restored, updatedAt: stamp(), pending: 1 }),
    reviews.delete(recordId),
    // Delete it remotely too. Even a pending answer may be mid-upload.
    record?.uid ? tx.objectStore('deleted').put({ uid: record.uid }) : undefined,
    tx.done,
  ]);
  notifyProgress();
}

export async function getReviewsSince(since: Date): Promise<ReviewRecord[]> {
  return (await db()).getAllFromIndex('reviews', 'review', IDBKeyRange.lowerBound(since));
}

export async function getAllReviews(): Promise<ReviewRecord[]> {
  return (await db()).getAll('reviews');
}

export async function clearProgress(): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews', 'deleted'], 'readwrite');
  await Promise.all([tx.objectStore('cards').clear(), tx.objectStore('reviews').clear(), tx.objectStore('deleted').clear(), tx.done]);
  notifyProgress();
}

/** Replace all progress with the given cards and review log (restoring a backup). */
export async function replaceProgress(cards: readonly WordCard[], reviews: readonly ReviewRecord[]): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews', 'deleted'], 'readwrite');
  const cardStore = tx.objectStore('cards');
  const reviewStore = tx.objectStore('reviews');
  const now = stamp();
  const seen = new Set<string>();
  await Promise.all([
    cardStore.clear(),
    reviewStore.clear(),
    tx.objectStore('deleted').clear(),
    ...cards.map((c) => cardStore.put({ ...c, updatedAt: now, pending: 1 })),
    ...reviews.map(({ id: _id, ...r }) => {
      // Keep shared ids from the backup unless the file repeats one.
      const uid = r.uid && !seen.has(r.uid) ? r.uid : newUid();
      seen.add(uid);
      return reviewStore.add({ ...r, uid, pending: 1 });
    }),
    tx.done,
  ]);
  notifyProgress();
}

// ---- Sync support ----

export async function getPendingCards(): Promise<WordCard[]> {
  return (await db()).getAllFromIndex('cards', 'pending');
}

export async function getPendingReviews(): Promise<ReviewRecord[]> {
  return (await db()).getAllFromIndex('reviews', 'pending');
}

export async function getDeletedReviewIds(): Promise<string[]> {
  return (await db()).getAllKeys('deleted');
}

export async function countPending(): Promise<number> {
  const database = await db();
  const [cards, reviews, deleted] = await Promise.all([
    database.countFromIndex('cards', 'pending'),
    database.countFromIndex('reviews', 'pending'),
    database.count('deleted'),
  ]);
  return cards + reviews + deleted;
}

/** Clear the pending mark on uploaded cards, unless a card changed again meanwhile. */
export async function markCardsSynced(uploaded: readonly WordCard[]): Promise<void> {
  const tx = (await db()).transaction('cards', 'readwrite');
  const store = tx.store;
  await Promise.all([
    ...uploaded.map(async (sent) => {
      const current = await store.get(sent.id);
      if (current?.pending && current.updatedAt === sent.updatedAt) {
        const { pending: _p, ...rest } = current;
        await store.put(rest);
      }
    }),
    tx.done,
  ]);
}

export async function markReviewsSynced(uids: readonly string[]): Promise<void> {
  const tx = (await db()).transaction('reviews', 'readwrite');
  const byUid = tx.store.index('uid');
  await Promise.all([
    ...uids.map(async (uid) => {
      const key = await byUid.getKey(uid);
      const record = key === undefined ? undefined : await tx.store.get(key);
      if (record?.pending) {
        const { pending: _p, ...rest } = record;
        await tx.store.put(rest);
      }
    }),
    tx.done,
  ]);
}

export async function clearDeletedReviewIds(uids: readonly string[]): Promise<void> {
  const tx = (await db()).transaction('deleted', 'readwrite');
  await Promise.all([...uids.map((uid) => tx.store.delete(uid)), tx.done]);
}

/**
 * Merge cards and answers from other devices. A card is taken when it is
 * newer than the copy here; an answer is added unless it is already here or
 * was undone here. Returns how many records changed.
 */
export async function mergeRemote(cards: readonly WordCard[], reviews: readonly ReviewRecord[]): Promise<number> {
  if (cards.length === 0 && reviews.length === 0) return 0;
  const tx = (await db()).transaction(['cards', 'reviews', 'deleted'], 'readwrite');
  const cardStore = tx.objectStore('cards');
  const reviewStore = tx.objectStore('reviews');
  const deleted = tx.objectStore('deleted');
  // A page boundary can repeat a row: keep the newest card and one copy of each answer.
  const newest = new Map<string, WordCard>();
  for (const c of cards) if ((newest.get(c.id)?.updatedAt ?? -1) < (c.updatedAt ?? 0)) newest.set(c.id, c);
  const answers = new Map(reviews.filter((r) => r.uid).map((r) => [r.uid!, r]));
  let changed = 0;
  await Promise.all([
    ...[...newest.values()].map(async (remote) => {
      const local = await cardStore.get(remote.id);
      if (!local || (local.updatedAt ?? 0) < (remote.updatedAt ?? 0)) {
        const { pending: _p, ...clean } = remote;
        await cardStore.put(clean);
        changed++;
      }
    }),
    ...[...answers.values()].map(async (remote) => {
      const [here, undone] = await Promise.all([reviewStore.index('uid').getKey(remote.uid!), deleted.get(remote.uid!)]);
      if (here !== undefined || undone) return;
      const { id: _id, pending: _p, ...clean } = remote;
      await reviewStore.add(clean);
      changed++;
    }),
    tx.done,
  ]);
  if (changed > 0) notifyProgress('remote');
  return changed;
}

/** Drop all local progress because it was reset elsewhere or belongs to another account. */
export async function clearProgressFromRemote(): Promise<void> {
  const tx = (await db()).transaction(['cards', 'reviews', 'deleted'], 'readwrite');
  await Promise.all([tx.objectStore('cards').clear(), tx.objectStore('reviews').clear(), tx.objectStore('deleted').clear(), tx.done]);
  notifyProgress('remote');
}

/** Close the connection (used by tests to start from a fresh database). */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
