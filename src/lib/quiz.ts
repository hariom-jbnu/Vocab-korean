import type { VocabItem, VisibilitySettings } from '../types';
import { Rating, State, type Grade, type WordCard } from './srs';

/**
 * The question ladder: recognise the written word first, then the spoken
 * word, then produce it by typing, as the memory gets more stable.
 */
export type Exercise = 'choice' | 'listen' | 'type';

/** Stability (days) at which a word moves up to the listening round. */
export const LISTEN_FROM_DAYS = 3;
/** Stability (days) at which a word moves up to typing. */
export const TYPE_FROM_DAYS = 21;

export function chooseExercise(
  card: WordCard | undefined,
  { canListen, canType }: { canListen: boolean; canType: boolean }
): Exercise {
  if (!card || card.state !== State.Review) return 'choice';
  if (card.stability >= TYPE_FROM_DAYS && canType) return 'type';
  if (card.stability >= LISTEN_FROM_DAYS && canListen) return 'listen';
  return 'choice';
}

/** Split a gloss such as "store, shop; eggplant" into its separate meanings. */
export function meanings(gloss: string): string[] {
  return gloss
    .split(/[,;]/)
    .map((m) => m.replace(/\(.*?\)/g, '').replace(/~/g, '').trim().toLowerCase())
    .filter(Boolean);
}

const isPredicate = (w: VocabItem) => w.ko.endsWith('다');
const firstSyllable = (w: VocabItem) => w.ko[0];

/**
 * Pick `count` wrong answers for a multiple-choice question.
 *
 * Good distractors look like plausible answers: the same kind of word
 * (verbs and adjectives ending in 다 against each other), a similar length,
 * and no shared meaning with the right answer. Words that start with the
 * same syllable are left out so beginners are not tested on look-alikes.
 */
export function pickDistractors(
  word: VocabItem,
  pool: readonly VocabItem[],
  count = 3,
  random: () => number = Math.random
): VocabItem[] {
  const answer = new Set(meanings(word.en));
  const usable = pool.filter(
    (w) =>
      w.id !== word.id &&
      firstSyllable(w) !== firstSyllable(word) &&
      !meanings(w.en).some((m) => answer.has(m)) &&
      w.hi !== word.hi
  );

  const score = (w: VocabItem) =>
    (isPredicate(w) === isPredicate(word) ? 0 : 2) + Math.abs(w.ko.length - word.ko.length) * 0.5 + random() * 1.5;

  const ranked = usable.map((w) => ({ w, s: score(w) })).sort((a, b) => a.s - b.s);

  const picked: VocabItem[] = [];
  const seen = new Set<string>();
  for (const { w } of ranked) {
    const key = meanings(w.en)[0] ?? w.en;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(w);
    if (picked.length === count) break;
  }
  return picked;
}

/** The answer plus distractors, shuffled. */
export function buildChoices(
  word: VocabItem,
  pool: readonly VocabItem[],
  count = 4,
  random: () => number = Math.random
): VocabItem[] {
  const options = [word, ...pickDistractors(word, pool, count - 1, random)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** Text shown for a meaning, following the learner's language choice. */
export function meaningLines(word: VocabItem, visibility: VisibilitySettings): { en?: string; hi?: string } {
  const showEn = visibility.en || !visibility.hi;
  const showHi = visibility.hi || !visibility.en;
  return { en: showEn ? word.en : undefined, hi: showHi ? word.hi : undefined };
}

/** Slower than this counts as a hesitant answer. */
export const SLOW_CHOICE_MS = 8000;

/**
 * Turn a quiz result into an FSRS grade. Wrong is Again, slow is Hard,
 * otherwise Good. Multiple choice never gives Easy, since guessing is
 * possible.
 */
export function gradeChoice(correct: boolean, ms: number): Grade {
  if (!correct) return Rating.Again;
  return ms > SLOW_CHOICE_MS ? Rating.Hard : Rating.Good;
}

/**
 * Grade a typed answer. Wrong is Again; a one-letter slip or a slow answer
 * is Hard; a quick exact answer is Easy; anything else is Good.
 */
export function gradeTyped({ correct, nearMiss }: { correct: boolean; nearMiss: boolean }, ms: number): Grade {
  if (!correct) return nearMiss ? Rating.Hard : Rating.Again;
  if (ms < 6000) return Rating.Easy;
  if (ms > 15000) return Rating.Hard;
  return Rating.Good;
}
