import type { VocabItem, VisibilitySettings } from '../types';
import { Rating, State, type Grade, type WordCard } from './srs';
import { editDistance, toJamo } from './hangul';

/**
 * Question types:
 * - choice: see the Korean word, recall the meaning, then pick it
 * - listen: hear the word (or read its sound when there is no Korean voice), recall, pick
 * - reverse: see the meaning, pick the Korean word among look-alikes
 * - type: see the meaning, type the Korean word
 */
export type Exercise = 'choice' | 'listen' | 'reverse' | 'type';

/**
 * recognition: the learner spots or recalls the meaning. production: the
 * learner produces the Korean word. A word cannot get long gaps on
 * recognition alone (see RECOGNITION_CAP_DAYS).
 */
export type Phase = 'recognition' | 'production';

export interface Round {
  exercise: Exercise;
  phase: Phase;
}

/** Memory strength (days) from which rounds rotate between question types. */
export const ROTATE_FROM_DAYS = 2;
/** Memory strength (days) from which every round asks for the Korean word. */
export const PRODUCE_FROM_DAYS = 7;

/**
 * Pick the question for a card:
 * - new, learning, or under 2 days: Korean to meaning, recall first
 * - 2 to 7 days: rotate meaning to Korean, listening, Korean to meaning
 * - 7 days or more: typing, or meaning to Korean when typing is off
 * The rotation follows the card's review count, so it changes every time.
 */
export function chooseRound(
  card: WordCard | undefined,
  { canListen, canType, hasSound }: { canListen: boolean; canType: boolean; hasSound: boolean }
): Round {
  if (!card || card.state !== State.Review || card.stability < ROTATE_FROM_DAYS) return { exercise: 'choice', phase: 'recognition' };
  if (card.stability >= PRODUCE_FROM_DAYS) return { exercise: canType ? 'type' : 'reverse', phase: 'production' };
  const turn = card.reps % 3;
  if (turn === 1 && (canListen || hasSound)) return { exercise: 'listen', phase: 'recognition' };
  if (turn === 2) return { exercise: 'choice', phase: 'recognition' };
  return { exercise: 'reverse', phase: 'recognition' };
}

/** Split a gloss at top-level commas and semicolons, keeping notes in brackets whole. */
function splitGloss(gloss: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of gloss) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.replace(/~/g, '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
}

/** Split a gloss such as "store, shop; eggplant" into its meanings, without notes in brackets. */
export function meanings(gloss: string): string[] {
  return splitGloss(gloss)
    .map((m) => m.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * How two glosses relate: "same" when they share a meaning (store, shop / shop),
 * "nuance" when they share a meaning but their notes tell them apart
 * (older sister (said by a male) / older sister (said by a female)), else "none".
 */
export function meaningRelation(a: string, b: string): 'same' | 'nuance' | 'none' {
  const fullA = splitGloss(a);
  const fullB = splitGloss(b);
  const bare = (m: string) => m.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  let nuance = false;
  for (const ma of fullA) {
    for (const mb of fullB) {
      if (bare(ma) !== bare(mb) || !bare(ma)) continue;
      if (ma === mb || !ma.includes('(') || !mb.includes('(')) return 'same';
      nuance = true;
    }
  }
  return nuance ? 'nuance' : 'none';
}

export type WordKind = 'noun' | 'verb' | 'adjective';

/** Verbs and adjectives end in 다; "to be …" glosses (and glosses without "to") are adjectives. */
export function wordKind(w: VocabItem): WordKind {
  if (!w.ko.endsWith('다')) return 'noun';
  const en = w.en.trim().toLowerCase();
  return en.startsWith('to ') && !en.startsWith('to be ') ? 'verb' : 'adjective';
}

const EN_STOP = new Set(['to', 'be', 'the', 'a', 'an', 'of', 'for', 'and', 'or', 'by', 'with', 'said', 'someone', 'something', 'thing', 'things', 'counter', 'native', 'sino']);
const HI_STOP = new Set(['करना', 'होना', 'का', 'की', 'के', 'में', 'से', 'को', 'है', 'और', 'एक', 'पर', 'लिए']);

const words = (text: string, stop: Set<string>) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{M}]+/u)
      .filter((t) => t.length >= 3 && !stop.has(t))
  );

const shares = (a: Set<string>, b: Set<string>) => [...a].some((t) => b.has(t));

/** Korean that looks or sounds alike: shared syllables, or a small difference in letters. */
export function lookAlike(a: string, b: string): number {
  const sa = new Set(a);
  const sharedSyllables = [...new Set(b)].filter((ch) => sa.has(ch)).length;
  const ja = toJamo(a);
  const jb = toJamo(b);
  const closeness = 1 - editDistance(ja, jb) / Math.max(ja.length, jb.length, 1);
  return Math.min(sharedSyllables, 2) + (closeness >= 0.6 ? 1 : 0) + (a[0] === b[0] ? 0.5 : 0) + (a.length === b.length ? 0.5 : 0);
}

export interface DistractorOptions {
  /** How many wrong options to return. */
  count?: number;
  /** Ids of words the learner has already studied: preferred, so every option looks familiar. */
  studied?: ReadonlySet<string>;
  /** Ids to leave out if possible (wrong options this word used recently). */
  avoid?: ReadonlySet<string>;
  /** What the options show: meanings (Korean to meaning) or Korean words (meaning to Korean). */
  show?: 'meaning' | 'korean';
  random?: () => number;
}

/**
 * Pick wrong options that are hard to rule out:
 * - words the learner has already studied, so the answer does not stand out as the only familiar one
 * - the same kind of word (noun, verb, adjective) and the same topic
 * - Korean that looks or sounds alike (학교 / 학생), most of all when the options show Korean
 * - meanings that differ only in a detail (older sister said by a male / by a female)
 * Never a true synonym, the same Hindi, or the same Korean spelling (눈 snow / 눈 eye),
 * since then two options would be right. Recently used options are skipped while
 * enough others remain.
 */
export function pickDistractors(word: VocabItem, pool: readonly VocabItem[], opts: DistractorOptions = {}): VocabItem[] {
  const { count = 3, studied, avoid, show = 'meaning', random = Math.random } = opts;
  const kind = wordKind(word);
  const enWords = words(word.en, EN_STOP);
  const hiWords = words(word.hi, HI_STOP);

  const candidates: { w: VocabItem; score: number }[] = [];
  for (const w of pool) {
    if (w.id === word.id || w.ko === word.ko || w.hi === word.hi) continue;
    const relation = meaningRelation(word.en, w.en);
    if (relation === 'same') continue;

    let score = 0;
    if (studied?.has(w.id)) score += 4;
    const k = wordKind(w);
    if (k === kind) score += 2;
    else if (k === 'noun' || kind === 'noun') score -= 3;
    if (word.topic && w.topic === word.topic) score += 2;
    score += lookAlike(word.ko, w.ko) * (show === 'korean' ? 2 : 0.75);
    if (relation === 'nuance') score += 2;
    if (shares(enWords, words(w.en, EN_STOP))) score += 1;
    if (shares(hiWords, words(w.hi, HI_STOP))) score += 1;
    score += random() * 2;
    candidates.push({ w, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  const take = (allowAvoided: boolean, picked: VocabItem[]) => {
    for (const { w } of candidates) {
      if (picked.length >= count) break;
      if (picked.includes(w)) continue;
      if (!allowAvoided && avoid?.has(w.id)) continue;
      // No two options that read the same.
      const clash = picked.some((p) =>
        show === 'korean' ? p.ko === w.ko : p.hi === w.hi || meaningRelation(p.en, w.en) === 'same'
      );
      if (!clash) picked.push(w);
    }
    return picked;
  };
  const picked = take(false, []);
  // Early on few words exist to choose from: fall back to recently used options.
  return picked.length < count ? take(true, picked) : picked;
}

/** How often the right answer is left out, so "Not in the list" is the right pick. */
export const MISSING_CHANCE = 0.2;

export interface Question {
  /** The options in the order shown (four of them). */
  options: VocabItem[];
  /** False when the answer was left out on purpose. */
  answerShown: boolean;
}

/**
 * Four options for a question. When `allowMissing` is set, about one question
 * in five (at random, not in a pattern) leaves the answer out, so only
 * knowing the word, not spotting the familiar option, gets it right.
 */
export function buildQuestion(
  word: VocabItem,
  pool: readonly VocabItem[],
  { count = 4, allowMissing = false, random = Math.random, ...opts }: DistractorOptions & { allowMissing?: boolean } = {}
): Question {
  let missing = allowMissing && random() < MISSING_CHANCE;
  let distractors = pickDistractors(word, pool, { ...opts, random, count: missing ? count : count - 1 });
  if (missing && distractors.length < count) {
    missing = false;
    distractors = distractors.slice(0, count - 1);
  }
  const options = missing ? distractors : [word, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answerShown: !missing };
}

/** Text shown for a meaning, following the learner's language choice. */
export function meaningLines(word: VocabItem, visibility: VisibilitySettings): { en?: string; hi?: string } {
  const showEn = visibility.en || !visibility.hi;
  const showHi = visibility.hi || !visibility.en;
  return { en: showEn ? word.en : undefined, hi: showHi ? word.hi : undefined };
}

/** Recalling slower than this (before asking for the choices) counts as hesitant. */
export const SLOW_RECALL_MS = 6000;
/** Picking slower than this counts as hesitant. */
export const SLOW_CHOICE_MS = 8000;

/** right: correct; wrong: a wrong pick; dontKnow: said "I don't know"; near: a one-letter slip when typing. */
export type Outcome = 'right' | 'wrong' | 'dontKnow' | 'near';

/**
 * Grade a choice round. Anything but a right pick is Again; slow recall or a
 * slow pick is Hard; otherwise Good. Choices never give Easy, since the
 * options help.
 */
export function gradeChoice({ outcome, recallMs, chooseMs }: { outcome: Outcome; recallMs?: number; chooseMs: number }): Grade {
  if (outcome !== 'right') return Rating.Again;
  if ((recallMs ?? 0) > SLOW_RECALL_MS || chooseMs > SLOW_CHOICE_MS) return Rating.Hard;
  return Rating.Good;
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
