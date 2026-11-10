import { Rating, State, type ReviewRecord, type WordCard } from './srs';
import { endOfStudyDay, startOfStudyDay, studyDayKey } from './day';

/**
 * Named stages on top of FSRS stability, so progress is easy to read
 * ("312 words known") while FSRS still does the scheduling.
 */
export type Stage = 'new' | 'learning' | 'young' | 'familiar' | 'known' | 'mastered';

export const STAGES: readonly Stage[] = ['new', 'learning', 'young', 'familiar', 'known', 'mastered'];

export const STAGE_INFO: Record<Stage, { label: string; hint: string }> = {
  new: { label: 'New', hint: 'Not studied yet' },
  learning: { label: 'Learning', hint: 'Seen today or just forgotten' },
  young: { label: 'Young', hint: 'Remembered for under a week' },
  familiar: { label: 'Familiar', hint: 'Remembered for 1 to 3 weeks' },
  known: { label: 'Known', hint: 'Remembered for 3 weeks to 3 months' },
  mastered: { label: 'Mastered', hint: 'Remembered for over 3 months' },
};

/** Stability (days) from which a word counts as known. */
export const KNOWN_DAYS = 21;

export function stageOf(card: WordCard | undefined): Stage {
  if (!card || card.state === State.New) return 'new';
  if (card.state !== State.Review || card.stability < 1) return 'learning';
  if (card.stability < 7) return 'young';
  if (card.stability < KNOWN_DAYS) return 'familiar';
  if (card.stability < 90) return 'known';
  return 'mastered';
}

export function stageCounts(wordIds: readonly string[], cards: ReadonlyMap<string, WordCard>): Record<Stage, number> {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const id of wordIds) counts[stageOf(cards.get(id))]++;
  return counts;
}

/**
 * True retention: the share of answers on words already learned (not new
 * or still in learning steps) that were not Again. It should sit close to
 * the target recall when the scheduler is working.
 */
export function trueRetention(reviews: readonly ReviewRecord[], since: Date): { rate: number | null; count: number } {
  const relevant = reviews.filter((r) => r.state === State.Review && r.review.getTime() >= since.getTime());
  if (relevant.length === 0) return { rate: null, count: 0 };
  const passed = relevant.filter((r) => r.rating !== Rating.Again).length;
  return { rate: passed / relevant.length, count: relevant.length };
}

/** Reviews due on each of the next `days` study days. Day 0 includes overdue cards. */
export function forecast(cards: Iterable<WordCard>, now: Date, days = 14): number[] {
  const out = new Array<number>(days).fill(0);
  const bounds = Array.from({ length: days }, (_, i) => endOfStudyDay(addDays(now, i)).getTime());
  for (const c of cards) {
    if (c.state === State.New) continue;
    const t = c.due.getTime();
    const i = bounds.findIndex((b) => t < b);
    if (i !== -1) out[i]++;
  }
  return out;
}

/** Answers per study day for the last `days` days, oldest first. */
export function dailyActivity(reviews: readonly ReviewRecord[], now: Date, days = 30): { day: string; count: number }[] {
  const keys = Array.from({ length: days }, (_, i) => studyDayKey(addDays(now, i - days + 1)));
  const counts = new Map(keys.map((k) => [k, 0]));
  const from = startOfStudyDay(addDays(now, -days + 1)).getTime();
  for (const r of reviews) {
    if (r.review.getTime() < from) continue;
    const k = studyDayKey(r.review);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return keys.map((day) => ({ day, count: counts.get(day)! }));
}

/** Words forgotten most often, then hardest by FSRS difficulty. */
export function hardestWords(cards: Iterable<WordCard>, limit = 10): WordCard[] {
  return [...cards]
    .filter((c) => c.state !== State.New && (c.lapses > 0 || c.difficulty >= 7))
    .sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty)
    .slice(0, limit);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
