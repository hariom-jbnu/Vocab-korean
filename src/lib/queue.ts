import { State, type ReviewRecord, type WordCard } from './srs';
import { endOfStudyDay, startOfStudyDay } from './day';

export interface QueueOptions {
  /** New words to introduce per study day. */
  newPerDay: number;
  /** Seed for the shuffled order of new words; stays the same per learner. */
  seed: number;
  /** Stop adding new words while more reviews than this are due. */
  pauseNewAbove?: number;
}

export interface DailyQueue {
  /** Word ids already learned and due today, oldest due first. */
  reviews: string[];
  /** Word ids to introduce today, in shuffled order. */
  newWords: string[];
  /** New words already introduced today. */
  newDoneToday: number;
  /** Answers given today (any state). */
  answeredToday: number;
}

/**
 * Build today's study queue: due reviews first, then a capped number of new
 * words in a per-learner shuffled order instead of the alphabetical CSV
 * order, which puts look-alike words (가다, 가르치다, 가방) back to back.
 */
export function buildDailyQueue(
  wordIds: readonly string[],
  cards: ReadonlyMap<string, WordCard>,
  todaysReviews: readonly ReviewRecord[],
  now: Date,
  { newPerDay, seed, pauseNewAbove = 100 }: QueueOptions
): DailyQueue {
  const dayEnd = endOfStudyDay(now).getTime();

  const reviews = [...cards.values()]
    .filter((c) => c.state !== State.New && c.due.getTime() < dayEnd)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .map((c) => c.id);

  const dayStart = startOfStudyDay(now).getTime();
  const today = todaysReviews.filter((r) => r.review.getTime() >= dayStart);
  const newDoneToday = new Set(today.filter((r) => r.state === State.New).map((r) => r.wordId)).size;

  let newWords: string[] = [];
  const allowance = Math.max(0, Math.floor(newPerDay) - newDoneToday);
  if (allowance > 0 && reviews.length <= pauseNewAbove) {
    const unseen = wordIds.filter((id) => {
      const card = cards.get(id);
      return !card || card.state === State.New;
    });
    newWords = seededShuffle(unseen, seed).slice(0, allowance);
  }

  return { reviews, newWords, newDoneToday, answeredToday: today.length };
}

/**
 * Pick the next card in a session. Learning cards that are due come first,
 * then the main queue, then learning cards that are not due yet (learning
 * ahead) so the session can finish.
 */
export function pickNext(
  queue: readonly string[],
  learning: ReadonlyMap<string, Date>,
  now: Date
): string | undefined {
  let dueLearning: string | undefined;
  let dueAt = Infinity;
  let earliest: string | undefined;
  let earliestAt = Infinity;
  for (const [id, due] of learning) {
    const t = due.getTime();
    if (t <= now.getTime() && t < dueAt) {
      dueLearning = id;
      dueAt = t;
    }
    if (t < earliestAt) {
      earliest = id;
      earliestAt = t;
    }
  }
  return dueLearning ?? queue[0] ?? earliest;
}

/** Deterministic Fisher-Yates shuffle (mulberry32 PRNG). */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
