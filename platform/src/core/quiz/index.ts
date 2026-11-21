/**
 * Quiz engine, ported from the Korean app's recall-first quiz (PR #2,
 * src/lib/quiz.ts and src/lib/answerPolicy.ts) and made language-neutral:
 * - Korean-only checks (Hangul look-alikes, 다 endings) moved behind a ScriptAdapter
 * - VocabItem (ko / hi / en) became Card (term / meaning / meaningAlt)
 * The scoring ideas are unchanged: wrong options a learner cannot rule out
 * by elimination, "Not in the list", and grades from correctness and speed.
 */
import type { Card } from '../types';
import type { ScriptAdapter } from '../script';
import { Rating, type Grade, type SrsState } from '../srs';

/* ---------------- Meanings ---------------- */

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

/** "store, shop; eggplant" -> ["store", "shop", "eggplant"], without notes in brackets. */
export function meanings(gloss: string): string[] {
  return splitGloss(gloss)
    .map((m) => m.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * "same" when two glosses share a meaning (store, shop / shop), "nuance" when
 * only their notes tell them apart (older sister (said by a male) / (said by
 * a female)), else "none".
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

const STOP = new Set(['to', 'be', 'the', 'a', 'an', 'of', 'for', 'and', 'or', 'by', 'with', 'said', 'someone', 'something', 'thing', 'things']);
const tokens = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{M}]+/u)
      .filter((t) => t.length >= 3 && !STOP.has(t))
  );
const shares = (a: Set<string>, b: Set<string>) => [...a].some((t) => b.has(t));

/* ---------------- Wrong options ---------------- */

export interface DistractorOptions {
  count?: number;
  /** Cards the learner has studied: preferred, so the answer is not the only familiar option. */
  studied?: ReadonlySet<string>;
  /** Cards to leave out if possible (options this card showed recently). */
  avoid?: ReadonlySet<string>;
  /** What options show: meanings (term -> meaning) or terms (meaning -> term). */
  show?: 'meaning' | 'term';
  random?: () => number;
}

const posOf = (c: Card, adapter: ScriptAdapter) => c.pos || adapter.guessPos?.(c.term, c.meaning);

/**
 * Pick wrong options that are hard to rule out: studied words, the same part
 * of speech and topic, look-alike terms, and meanings that differ only in a
 * note. Never a true synonym or the same term, since then two options would
 * be right. Recently used options are skipped while enough others remain.
 */
export function pickDistractors(card: Card, pool: readonly Card[], adapter: ScriptAdapter, opts: DistractorOptions = {}): Card[] {
  const { count = 3, studied, avoid, show = 'meaning', random = Math.random } = opts;
  const kind = posOf(card, adapter);
  const myTokens = tokens(card.meaning);
  const myAlt = card.meaningAlt ? tokens(card.meaningAlt) : undefined;

  const candidates: { c: Card; score: number }[] = [];
  for (const c of pool) {
    if (c.id === card.id || c.term === card.term) continue;
    if (card.meaningAlt && c.meaningAlt === card.meaningAlt) continue;
    const relation = meaningRelation(card.meaning, c.meaning);
    if (relation === 'same') continue;

    let score = 0;
    if (studied?.has(c.id)) score += 4;
    const k = posOf(c, adapter);
    if (kind && k) {
      if (k === kind) score += 2;
      else if (k === 'noun' || kind === 'noun') score -= 3;
    }
    if (card.topic && c.topic === card.topic) score += 2;
    score += adapter.lookAlike(card.term, c.term) * (show === 'term' ? 2 : 0.75);
    if (relation === 'nuance') score += 2;
    if (shares(myTokens, tokens(c.meaning))) score += 1;
    if (myAlt && c.meaningAlt && shares(myAlt, tokens(c.meaningAlt))) score += 1;
    score += random() * 2;
    candidates.push({ c, score });
  }
  candidates.sort((a, b) => b.score - a.score);

  const take = (allowAvoided: boolean, picked: Card[]) => {
    for (const { c } of candidates) {
      if (picked.length >= count) break;
      if (picked.includes(c)) continue;
      if (!allowAvoided && avoid?.has(c.id)) continue;
      const clash = picked.some((p) => (show === 'term' ? p.term === c.term : meaningRelation(p.meaning, c.meaning) === 'same'));
      if (!clash) picked.push(c);
    }
    return picked;
  };
  const picked = take(false, []);
  return picked.length < count ? take(true, picked) : picked;
}

/** How often the right answer is left out, so "Not in the list" is the right pick. */
export const MISSING_CHANCE = 0.2;

export interface Question {
  options: Card[];
  /** False when the answer was left out on purpose. */
  answerShown: boolean;
}

/**
 * Four options. With `allowMissing`, about one question in five leaves the
 * answer out, so only knowing the word (not spotting the familiar option)
 * gets it right.
 */
export function buildQuestion(
  card: Card,
  pool: readonly Card[],
  adapter: ScriptAdapter,
  { count = 4, allowMissing = false, random = Math.random, ...opts }: DistractorOptions & { allowMissing?: boolean } = {}
): Question {
  let missing = allowMissing && random() < MISSING_CHANCE;
  let distractors = pickDistractors(card, pool, adapter, { ...opts, random, count: missing ? count : count - 1 });
  if (missing && distractors.length < count) {
    missing = false;
    distractors = distractors.slice(0, count - 1);
  }
  const options = missing ? distractors : [card, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answerShown: !missing };
}

/* ---------------- Grading ---------------- */

/** right; wrong pick; said "I don't know"; a one-letter slip when typing. */
export type Outcome = 'right' | 'wrong' | 'dontKnow' | 'near';

export const SLOW_RECALL_MS = 6000;
export const SLOW_CHOICE_MS = 8000;

/** Anything but a right pick is Again; slow is Hard; else Good. Options never give Easy. */
export function gradeChoice({ outcome, recallMs, chooseMs }: { outcome: Outcome; recallMs?: number; chooseMs: number }): Grade {
  if (outcome !== 'right') return Rating.Again;
  if ((recallMs ?? 0) > SLOW_RECALL_MS || chooseMs > SLOW_CHOICE_MS) return Rating.Hard;
  return Rating.Good;
}

/** Wrong is Again; a slip or a slow answer is Hard; a quick exact answer is Easy. */
export function gradeTyped(outcome: Outcome, ms: number): Grade {
  if (outcome === 'near') return Rating.Hard;
  if (outcome !== 'right') return Rating.Again;
  if (ms < 6000) return Rating.Easy;
  if (ms > 15000) return Rating.Hard;
  return Rating.Good;
}

/** Self-checked rounds (reading, paper writing): knew it is Good, else Again. */
export function gradeSelf(outcome: Outcome): Grade {
  return outcome === 'right' ? Rating.Good : outcome === 'near' ? Rating.Hard : Rating.Again;
}

/* ---------------- Answer policy ---------------- */

/** Recognising a word (vocab, reading, listening) never sets a gap longer than this. */
export const RECOGNITION_CAP_DAYS = 7;

/**
 * Recognition alone should not earn long gaps: from the Korean app, a word
 * reaches gaps over 7 days only by producing it (writing).
 */
export function capRecognition(next: SrsState, production: boolean, now: Date): SrsState {
  if (production) return next;
  const cap = now.getTime() + RECOGNITION_CAP_DAYS * 86_400_000;
  if (new Date(next.due).getTime() <= cap) return next;
  return { ...next, due: new Date(cap).toISOString(), scheduled_days: Math.min(next.scheduled_days, RECOGNITION_CAP_DAYS) };
}
