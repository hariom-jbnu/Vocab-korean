import { studyDayKey } from './day';

/** Answers needed on a day for it to count toward the streak. */
export const STREAK_MIN_ANSWERS = 5;

export interface StreakInfo {
  /** Days in the current streak, today included once it counts. */
  current: number;
  /** True once today has enough answers to count. */
  todayCounts: boolean;
  /** Days that were missed but forgiven by the weekly freeze. */
  frozen: string[];
}

/**
 * A forgiving streak: one short session keeps it alive, and one missed day
 * per 7 days is forgiven automatically. The streak is not broken until the
 * current day ends, so it shows yesterday's count until the learner studies.
 */
export function computeStreak(
  answersPerDay: ReadonlyMap<string, number>,
  now: Date,
  minAnswers = STREAK_MIN_ANSWERS
): StreakInfo {
  const counts = (d: Date) => (answersPerDay.get(studyDayKey(d)) ?? 0) >= minAnswers;
  const todayCounts = counts(now);

  let current = todayCounts ? 1 : 0;
  const frozen: string[] = [];
  let lastFreeze = -Infinity;
  const day = new Date(now);
  // Walk back day by day from yesterday.
  for (let i = 1; i < 3650; i++) {
    day.setDate(day.getDate() - 1);
    if (counts(day)) {
      current++;
      continue;
    }
    // A miss: forgive it if no freeze was used in the last 7 days and the
    // streak continues on the day before.
    const before = new Date(day);
    before.setDate(before.getDate() - 1);
    if (i - lastFreeze >= 7 && current > 0 && counts(before)) {
      lastFreeze = i;
      frozen.push(studyDayKey(day));
      continue;
    }
    break;
  }
  return { current, todayCounts, frozen };
}

/** Count answers per study day from review times. */
export function answersPerDay(reviewTimes: Iterable<Date>): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of reviewTimes) {
    const k = studyDayKey(t);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
