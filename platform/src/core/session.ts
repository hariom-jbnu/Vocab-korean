/**
 * One practice session, as plain data and pure functions, shared by all four
 * modes (vocab, reading, listening, writing).
 *
 * - Picks the words: due reviews first, then new words in deck order, then
 *   (if the deck is all caught up) the words due soonest, so there is always
 *   something to practice.
 * - Each word must be answered right `targetReps` times. A miss brings the
 *   word back two cards later.
 * - New words can get a "meet" card first (vocab mode).
 * - At the end, missed words get one more quick drill if the deck allows it.
 */
import type { DeckRules } from './rules';
import type { SkillMode } from './types';
import type { Outcome } from './quiz';
import type { SrsState } from './srs';

/** A met word comes back for its first question after this many other cards. */
export const MEET_GAP = 2;
/** A word answered right (but not yet enough times) comes back after this many cards. */
export const REPEAT_GAP = 3;
/** A missed word comes back after this many cards. */
export const RETRY_GAP = 2;
/** After this many misses a word leaves the main round (it is still drilled at the end). */
export const MAX_MISSES = 3;

export interface SessionItem {
  cardId: string;
  needed: number;
  correct: number;
  misses: number;
  isNew: boolean;
  /** False until the learner has seen the word's meet card. */
  met: boolean;
  /** True once the first answer was sent to the scheduler. */
  graded: boolean;
}

export interface SessionState {
  mode: SkillMode;
  phase: 'practice' | 'drill' | 'done';
  items: Record<string, SessionItem>;
  /** Upcoming cards; queue[0] is on screen. */
  queue: string[];
  /** Cards missed at least once, in the order they were first missed. */
  missed: string[];
  answers: number;
  right: number;
  firstTryRight: number;
  startedAt: number;
  finishedAt?: number;
}

export interface CardRef {
  id: string;
  position: number;
}

/** Choose up to `n` card ids for a session. */
export function pickSessionCards(cards: readonly CardRef[], progress: ReadonlyMap<string, SrsState>, n: number, now: Date): string[] {
  const t = now.getTime();
  const byDue = (a: CardRef, b: CardRef) => Date.parse(progress.get(a.id)!.due) - Date.parse(progress.get(b.id)!.due);
  const due = cards.filter((c) => progress.has(c.id) && Date.parse(progress.get(c.id)!.due) <= t).sort(byDue);
  const fresh = cards.filter((c) => !progress.has(c.id)).sort((a, b) => a.position - b.position);
  const ahead = cards.filter((c) => progress.has(c.id) && Date.parse(progress.get(c.id)!.due) > t).sort(byDue);
  return [...due, ...fresh, ...ahead].slice(0, n).map((c) => c.id);
}

export function startSession(
  cardIds: readonly string[],
  progress: ReadonlyMap<string, SrsState>,
  rules: DeckRules,
  mode: SkillMode,
  now = Date.now()
): SessionState {
  const items: Record<string, SessionItem> = {};
  for (const id of cardIds) {
    const isNew = !progress.has(id);
    items[id] = {
      cardId: id,
      needed: rules.targetReps,
      correct: 0,
      misses: 0,
      isNew,
      met: !(isNew && rules.meetNewWords && mode === 'vocab'),
      graded: false,
    };
  }
  return { mode, phase: cardIds.length ? 'practice' : 'done', items, queue: [...cardIds], missed: [], answers: 0, right: 0, firstTryRight: 0, startedAt: now, finishedAt: cardIds.length ? undefined : now };
}

export type Step = { kind: 'meet'; cardId: string } | { kind: 'question'; cardId: string; firstTry: boolean } | { kind: 'done' };

export function currentStep(s: SessionState): Step {
  if (s.phase === 'done' || s.queue.length === 0) return { kind: 'done' };
  const item = s.items[s.queue[0]];
  if (!item.met) return { kind: 'meet', cardId: item.cardId };
  return { kind: 'question', cardId: item.cardId, firstTry: !item.graded };
}

const insertAt = (queue: string[], id: string, gap: number) => {
  const q = [...queue];
  q.splice(Math.min(gap, q.length), 0, id);
  return q;
};

/** Move to the next phase when the queue runs out. */
function settle(s: SessionState, rules: DeckRules, now: number): SessionState {
  if (s.queue.length > 0) return s;
  if (s.phase === 'practice' && rules.endOfSession.missedDrill && s.missed.length > 0) {
    const items = { ...s.items };
    for (const id of s.missed) items[id] = { ...items[id], needed: 1, correct: 0, misses: 0, met: true };
    return { ...s, phase: 'drill', items, queue: [...s.missed] };
  }
  return { ...s, phase: 'done', finishedAt: now };
}

/** The learner has seen the meet card: the word's first question comes a little later. */
export function markMet(s: SessionState): SessionState {
  const [id, ...rest] = s.queue;
  if (!id) return s;
  return { ...s, items: { ...s.items, [id]: { ...s.items[id], met: true } }, queue: insertAt(rest, id, MEET_GAP) };
}

export interface AnswerResult {
  state: SessionState;
  /** True for the word's first answer in this session: only that one goes to the scheduler. */
  firstAnswer: boolean;
}

export function answer(s: SessionState, outcome: Outcome, rules: DeckRules, now = Date.now()): AnswerResult {
  const [id, ...rest] = s.queue;
  if (!id || s.phase === 'done') return { state: s, firstAnswer: false };
  const prev = s.items[id];
  const firstAnswer = !prev.graded && s.phase === 'practice';
  const ok = outcome === 'right' || outcome === 'near';
  const item: SessionItem = { ...prev, graded: true };
  let queue = rest;
  let missed = s.missed;

  if (ok) {
    item.correct += 1;
    if (item.correct < item.needed) queue = insertAt(rest, id, REPEAT_GAP);
  } else {
    item.misses += 1;
    item.correct = Math.max(0, item.correct - 1);
    if (!missed.includes(id)) missed = [...missed, id];
    if (item.misses < MAX_MISSES) queue = insertAt(rest, id, s.phase === 'drill' ? rest.length : RETRY_GAP);
  }

  const next: SessionState = {
    ...s,
    items: { ...s.items, [id]: item },
    queue,
    missed,
    answers: s.answers + 1,
    right: s.right + (ok ? 1 : 0),
    firstTryRight: s.firstTryRight + (firstAnswer && ok ? 1 : 0),
  };
  return { state: settle(next, rules, now), firstAnswer };
}

export interface SessionSummary {
  words: number;
  answers: number;
  firstTryRight: number;
  /** Share of words right on the first try, 0 to 100. */
  accuracy: number;
  missed: string[];
  durationMs: number;
}

export function summarize(s: SessionState, now = Date.now()): SessionSummary {
  const words = Object.keys(s.items).length;
  return {
    words,
    answers: s.answers,
    firstTryRight: s.firstTryRight,
    accuracy: words ? Math.round((s.firstTryRight / words) * 100) : 0,
    missed: s.missed,
    durationMs: (s.finishedAt ?? now) - s.startedAt,
  };
}

const NEXT_MODE: Record<SkillMode, SkillMode[]> = {
  vocab: ['listening', 'reading', 'writing'],
  reading: ['listening', 'writing', 'vocab'],
  listening: ['writing', 'reading', 'vocab'],
  writing: ['vocab', 'reading', 'listening'],
};

/** What to suggest after a session. */
export function nextStep(mode: SkillMode, rules: DeckRules, summary: SessionSummary): { mode: SkillMode; reason: string } {
  if (summary.accuracy < 60 || !Object.values(rules.modes).filter(Boolean).length) {
    return { mode, reason: 'A few words need another round. Practice them once more.' };
  }
  const next = NEXT_MODE[mode].find((m) => rules.modes[m]);
  if (!next) return { mode, reason: 'Great work. Come back later for your next review.' };
  const why: Record<SkillMode, string> = {
    vocab: 'Lock the meanings in with a quick word round.',
    reading: 'Now read the same words in sentences.',
    listening: 'Now train your ear: hear the same words.',
    writing: 'Now try writing the words yourself.',
  };
  return { mode: next, reason: why[next] };
}
