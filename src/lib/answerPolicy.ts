import { Rating, type Grade, type WordCard } from './srs';
import type { Outcome, Phase } from './quiz';

/** What happened in a quiz round, beyond its grade. */
export interface AnswerMeta {
  phase: Phase;
  outcome: Outcome;
  /** Said "I know it", then picked wrong. */
  falseConfidence?: boolean;
}

/** A recognition round (spotting or recalling the meaning) never sets a gap longer than this. */
export const RECOGNITION_CAP_DAYS = 7;
/** After a first miss at producing the word, it comes back this soon for another try. */
export const RETRY_MINUTES = 10;
/** Extra difficulty (FSRS scale 1 to 10) for saying "I know it" and then picking wrong. */
export const FALSE_CONFIDENCE_PENALTY = 1;

export interface FinalGrade {
  grade: Grade;
  /** Bring the word back this many minutes from now instead of the scheduled time. */
  retryMinutes?: number;
  /** Production misses in a row after this answer. */
  missStreak: number;
}

/**
 * Turn a round's grade into what the scheduler receives.
 *
 * Producing the word (typing, or picking the Korean) is tracked apart from
 * recognising it: a first miss there is graded Hard, so the memory strength
 * built by recognition is kept, and the word comes back in 10 minutes for
 * another try. A second miss in a row means it is really forgotten: Again.
 */
export function finalGrade(grade: Grade, meta: AnswerMeta | undefined, missStreak: number): FinalGrade {
  if (!meta || meta.phase !== 'production') return { grade, missStreak };
  if (meta.outcome === 'wrong' || meta.outcome === 'dontKnow') {
    return missStreak === 0 ? { grade: Rating.Hard, retryMinutes: RETRY_MINUTES, missStreak: 1 } : { grade: Rating.Again, missStreak: 0 };
  }
  return { grade, missStreak: meta.outcome === 'right' ? 0 : missStreak };
}

/**
 * Adjust a card after the scheduler has rated it:
 * - false confidence adds difficulty, so the word's gaps grow more slowly
 * - a retry brings the word back in a few minutes
 * - a recognition round caps the gap at 7 days, so a word reaches longer gaps
 *   only by producing it (from 7 days every round asks for the Korean word)
 */
export function adjustCard(card: WordCard, meta: AnswerMeta | undefined, final: FinalGrade, now: Date): WordCard {
  if (!meta) return card;
  const next = { ...card };
  if (meta.falseConfidence) next.difficulty = Math.min(10, next.difficulty + FALSE_CONFIDENCE_PENALTY);
  if (final.retryMinutes) {
    next.due = new Date(now.getTime() + final.retryMinutes * 60_000);
    next.scheduled_days = 0;
  } else if (meta.phase === 'recognition') {
    const cap = now.getTime() + RECOGNITION_CAP_DAYS * 86_400_000;
    if (next.due.getTime() > cap) {
      next.due = new Date(cap);
      next.scheduled_days = Math.min(next.scheduled_days, RECOGNITION_CAP_DAYS);
    }
  }
  return next;
}
