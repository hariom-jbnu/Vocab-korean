/**
 * Spaced repetition (FSRS via ts-fsrs), stored as plain JSON so any
 * database can hold it.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade } from 'ts-fsrs';

export { Rating, State };
export type { Grade };

/** FSRS memory state of one card for one learner and one skill, JSON friendly. */
export interface SrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: string;
}

export const DEFAULT_RETENTION = 0.9;

const schedulers = new Map<number, ReturnType<typeof fsrs>>();
function scheduler(retention: number) {
  let s = schedulers.get(retention);
  if (!s) {
    s = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: true, maximum_interval: 3650 }));
    schedulers.set(retention, s);
  }
  return s;
}

export function toStored(card: FsrsCard): SrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  };
}

export function fromStored(s: SrsState): FsrsCard {
  return { ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined } as FsrsCard;
}

export function newState(now: Date): SrsState {
  return toStored(createEmptyCard(now));
}

/** Apply one graded answer. `prev` is undefined for a card never studied. */
export function review(prev: SrsState | undefined, grade: Grade, now: Date, retention = DEFAULT_RETENTION): SrsState {
  const card = prev ? fromStored(prev) : createEmptyCard(now);
  return toStored(scheduler(retention).next(card, now, grade).card);
}

export const isDue = (s: SrsState | undefined, now: Date) => !!s && new Date(s.due).getTime() <= now.getTime();
