import type { VocabItem } from '../types';
import { seededShuffle } from './queue';
import { DAY_ROLLOVER_HOUR, startOfStudyDay } from './day';

/**
 * A study plan: learn `totalWords` words in `days` study days.
 *
 * The plan fixes the order in which new words arrive and how many arrive
 * each day. Reviews are not planned here: FSRS schedules each word's next
 * review from how well the learner knew it, which is what keeps the plan
 * honest. The review numbers below are only estimates for the schedule view.
 */
export type PlanOrder = 'mixed' | 'images' | 'common';

export interface StudyPlan {
  totalWords: number;
  days: number;
  order: PlanOrder;
  /** Study-day key (YYYY-MM-DD) of Day 1. */
  startDay: string;
}

export const PLAN_ORDERS: Record<PlanOrder, { label: string; description: string }> = {
  mixed: {
    label: 'Mixed (recommended)',
    description:
      'Your image words and common words take turns, and topics are spread out, so a day never holds ten clothing words that blur together.',
  },
  images: {
    label: 'My image words first',
    description: 'All the words from your images come first, then common words fill up the rest.',
  },
  common: {
    label: 'Common words first',
    description: 'Everyday TOPIK words come first, then the words from your images.',
  },
};

/** Days with more estimated study time than this get a warning. */
export const HEAVY_MINUTES = 60;

/**
 * Days after a word is first learned on which it usually comes back, when
 * the learner mostly answers Good at 90% desired retention. FSRS adapts the
 * real gaps per word; these only feed the time estimate.
 */
export const REVIEW_OFFSETS = [1, 3, 7, 15, 30];
/** About one review in ten is forgotten and relearned. */
export const LAPSE_RATE = 0.1;
/** First meeting with a word: see it, read both examples, two quick checks. */
export const SECONDS_PER_NEW = 40;
export const SECONDS_PER_REVIEW = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Spread two lists evenly through each other, keeping each list's order. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const pa = i < a.length ? (i + 0.5) / a.length : Infinity;
    const pb = j < b.length ? (j + 0.5) / b.length : Infinity;
    if (pa <= pb) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}

/**
 * The plan's words in the order they will be learned.
 *
 * Each group is shuffled with the learner's seed, which spreads each
 * image's topic across the whole plan: words from one semantic set learned
 * together get confused with each other (Tinkham 1993; Nakata & Suzuki 2019).
 * When the plan is smaller than the word list, "mixed" keeps the same share
 * of image words as the full list.
 */
export function planWordIds(words: readonly VocabItem[], totalWords: number, order: PlanOrder, seed: number): string[] {
  const images = seededShuffle(
    words.filter((w) => w.source === 'image').map((w) => w.id),
    seed
  );
  const common = seededShuffle(
    words.filter((w) => w.source !== 'image').map((w) => w.id),
    seed + 1
  );
  const all = images.length + common.length;
  const total = clamp(Math.round(totalWords), 0, all);
  const minImg = Math.max(0, total - common.length);
  const maxImg = Math.min(total, images.length);

  let nImg: number;
  if (order === 'images') nImg = maxImg;
  else if (order === 'common') nImg = minImg;
  else nImg = clamp(Math.round((total * images.length) / Math.max(1, all)), minImg, maxImg);

  const img = images.slice(0, nImg);
  const com = common.slice(0, total - nImg);
  if (order === 'images') return [...img, ...com];
  if (order === 'common') return [...com, ...img];
  return interleave(img, com);
}

/** How many new words land on day `day` (1-based), spread as evenly as possible. */
export function wordsOnDay(totalWords: number, days: number, day: number): number {
  if (days <= 0 || day < 1 || day > days) return 0;
  return Math.floor((day * totalWords) / days) - Math.floor(((day - 1) * totalWords) / days);
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, DAY_ROLLOVER_HOUR);
}

/** The calendar date of plan day `day` (1-based). */
export function planDate(startDay: string, day: number): Date {
  const d = parseDayKey(startDay);
  d.setDate(d.getDate() + day - 1);
  return d;
}

/** Which plan day `now` falls on: 1 on the start day, 0 or less before it. */
export function dayNumber(startDay: string, now: Date): number {
  const start = parseDayKey(startDay).getTime();
  const today = startOfStudyDay(now).getTime();
  // Round, because a daylight-saving change makes one day 23 or 25 hours.
  return Math.round((today - start) / 86_400_000) + 1;
}

export function estimateMinutes(newCount: number, reviewCount: number): number {
  return Math.round((newCount * SECONDS_PER_NEW + reviewCount * SECONDS_PER_REVIEW) / 60);
}

export interface PlanDay {
  day: number;
  date: Date;
  /** New words planned for this day, in learning order. */
  wordIds: string[];
  /** Estimated reviews of earlier words. */
  reviews: number;
  /** Estimated study time. */
  minutes: number;
}

/** Day 1 … Day N with each day's new words and an estimate of its reviews. */
export function buildSchedule(wordIds: readonly string[], days: number, startDay: string): PlanDay[] {
  const n = Math.max(1, Math.round(days));
  const slices: string[][] = [];
  let at = 0;
  for (let d = 1; d <= n; d++) {
    const count = wordsOnDay(wordIds.length, n, d);
    slices.push(wordIds.slice(at, at + count));
    at += count;
  }

  const reviews = new Array<number>(n).fill(0);
  slices.forEach((s, d) => {
    for (const off of REVIEW_OFFSETS) if (d + off < n) reviews[d + off] += s.length;
  });

  return slices.map((ids, d) => {
    const r = Math.round(reviews[d] * (1 + LAPSE_RATE));
    return { day: d + 1, date: planDate(startDay, d + 1), wordIds: ids, reviews: r, minutes: estimateMinutes(ids.length, r) };
  });
}

/**
 * New words to learn today. The plan re-balances every day: the words still
 * to learn are shared out over the days left, so a missed day spreads over
 * the rest of the plan instead of piling up, and working ahead makes later
 * days lighter. A day never asks for more than twice the planned pace.
 *
 * @param seenNow plan words already started, including today's
 * @param newDoneToday words first seen today
 */
export function todaysNewTarget(plan: StudyPlan, planSize: number, seenNow: number, newDoneToday: number, now: Date): number {
  const day = dayNumber(plan.startDay, now);
  if (day < 1 || planSize === 0) return 0;
  const remaining = Math.max(0, planSize - Math.max(0, seenNow - newDoneToday));
  const daysLeft = Math.max(1, plan.days - day + 1);
  const pace = Math.ceil(planSize / Math.max(1, plan.days));
  return Math.min(Math.ceil(remaining / daysLeft), pace * 2);
}
