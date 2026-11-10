import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';

export { Rating, State };
export type { Grade };

/** FSRS memory state for one word. `id` is the word id. */
export interface WordCard extends Card {
  id: string;
  /** When this copy was last changed on any device (ms). Newest copy wins in sync. */
  updatedAt?: number;
  /** Set while the change has not been uploaded yet. */
  pending?: 1;
}

/** One answer, kept forever. FSRS can rebuild every card from these. */
export interface ReviewRecord {
  /** Local key in this browser. */
  id?: number;
  /** Id shared across devices, so an answer synced twice is stored once. */
  uid?: string;
  /** Set while the answer has not been uploaded yet. */
  pending?: 1;
  wordId: string;
  rating: Grade;
  /** Card state before this answer (New, Learning, Review, Relearning). */
  state: State;
  /** When the answer was given. */
  review: Date;
  /** When the card was due before this answer. */
  due: Date;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  /** Time from showing the card to answering, in milliseconds. */
  durationMs?: number;
}

export const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
};

export const DEFAULT_RETENTION = 0.9;

export function createScheduler(retention = DEFAULT_RETENTION): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: clampRetention(retention),
      enable_fuzz: true,
      enable_short_term: true,
      maximum_interval: 3650,
    })
  );
}

export function clampRetention(r: number): number {
  return Math.min(0.97, Math.max(0.7, Number.isFinite(r) ? r : DEFAULT_RETENTION));
}

export function newCard(id: string, now: Date): WordCard {
  return { ...createEmptyCard(now), id };
}

/** Apply an answer to a card and return the new card plus a review record. */
export function rate(
  scheduler: FSRS,
  card: WordCard,
  grade: Grade,
  now: Date,
  durationMs?: number
): { card: WordCard; record: ReviewRecord } {
  const { card: next, log } = scheduler.next(card, now, grade);
  return {
    card: { ...next, id: card.id },
    record: {
      wordId: card.id,
      rating: grade,
      state: log.state,
      review: log.review,
      due: log.due,
      stability: log.stability,
      difficulty: log.difficulty,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      ...(durationMs !== undefined ? { durationMs: Math.round(durationMs) } : {}),
    },
  };
}

/** Next due time for each grade, for labels such as "Good · 10m". */
export function previewDue(scheduler: FSRS, card: WordCard, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(card, now);
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  };
}

/** Short human label for the gap between two times: 1m, 10m, 3h, 4d, 2mo, 1.5y. */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(0, (to.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = days / 365;
  return `${years < 10 ? Math.round(years * 10) / 10 : Math.round(years)}y`;
}

/** Recall probability right now, 0 to 1. New cards return 0. */
export function retrievability(scheduler: FSRS, card: WordCard, now: Date): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}
