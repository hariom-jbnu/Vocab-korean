/**
 * Deck rules: beginner-friendly defaults that a teacher can change per deck.
 *
 * A deck stores only the rules its teacher changed (overrides). Every read
 * lays them over DEFAULT_RULES, so a deck that never touched a rule follows
 * the default, even if the default improves later.
 */
import type { SkillMode } from './types';

export type AnswerStyle = 'recall-first' | 'options';
export type HintMode = 'show' | 'tap' | 'off';
export type WritingLevel = 'self-check' | 'guided' | 'strict';

export interface DeckRules {
  /** Words in one practice session. */
  wordsPerSession: number;
  /** Right answers each word needs before it leaves the session. */
  targetReps: number;
  /**
   * recall-first: the learner first tries to remember the meaning, then
   * presses "I know it" to see the options. options: options show at once.
   */
  answerStyle: AnswerStyle;
  /** Add a "Not in the list" option; about one question in five leaves the answer out. */
  notInList: boolean;
  /** Show a new word once (word, sound, meaning, examples) before its first question. */
  meetNewWords: boolean;
  endOfSession: {
    /** Repeat the words missed in this session before finishing. */
    missedDrill: boolean;
    /** Show a summary: score, time, missed words. */
    summary: boolean;
    /** Suggest what to practice next. */
    nextStep: boolean;
  };
  /** Which practice modes learners can pick. At least one stays on. */
  modes: Record<SkillMode, boolean>;
  reading: {
    /** Reading aid (romanization etc.): always shown, one tap away, or hidden. */
    hints: HintMode;
    /** Also read the example sentences, not only single words. */
    sentences: boolean;
  };
  listening: {
    /** Starting speech speed, 0.5 to 1.5. Learners can still change it. */
    speed: number;
    /** Pause between the word and its example sentence, in seconds. */
    gapSeconds: number;
    /** Show the reading aid when this device has no voice for the language. */
    textFallback: boolean;
    /** Play an example sentence after the word. */
    sentences: boolean;
  };
  writing: {
    /**
     * self-check: write on paper, then compare. guided (default): type or tap
     * letter tiles, small slips allowed. strict: type it exactly.
     */
    level: WritingLevel;
    /** Show the teacher's own writing prompts on cards that have one. */
    prompts: boolean;
  };
}

export const DEFAULT_RULES: DeckRules = Object.freeze({
  wordsPerSession: 10,
  targetReps: 2,
  answerStyle: 'recall-first',
  notInList: true,
  meetNewWords: true,
  endOfSession: { missedDrill: true, summary: true, nextStep: true },
  modes: { vocab: true, reading: true, listening: true, writing: true },
  reading: { hints: 'tap', sentences: true },
  listening: { speed: 0.9, gapSeconds: 1.5, textFallback: true, sentences: true },
  writing: { level: 'guided', prompts: true },
}) as DeckRules;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type RuleOverrides = DeepPartial<DeckRules>;

/** Allowed values for the text rules, and ranges for the number rules. */
const ENUMS: Record<string, readonly string[]> = {
  answerStyle: ['recall-first', 'options'],
  'reading.hints': ['show', 'tap', 'off'],
  'writing.level': ['self-check', 'guided', 'strict'],
};
const RANGES: Record<string, { min: number; max: number; step?: number }> = {
  wordsPerSession: { min: 3, max: 50, step: 1 },
  targetReps: { min: 1, max: 5, step: 1 },
  'listening.speed': { min: 0.5, max: 1.5 },
  'listening.gapSeconds': { min: 0, max: 5 },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A valid value for the rule at `path`, or undefined when `value` does not fit. */
function validValue(path: string, fallback: unknown, value: unknown): unknown {
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (typeof fallback === 'number') {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
    const range = RANGES[path];
    if (!range) return n;
    const clamped = Math.min(range.max, Math.max(range.min, n));
    return range.step ? Math.round(clamped / range.step) * range.step : Math.round(clamped * 100) / 100;
  }
  if (typeof fallback === 'string') return typeof value === 'string' && (ENUMS[path] ?? []).includes(value) ? value : undefined;
  return undefined;
}

/** Walk the default shape; for every rule take a valid override or the default. */
function merge(defaults: Record<string, unknown>, overrides: unknown, prefix: string): Record<string, unknown> {
  const src = isObject(overrides) ? overrides : {};
  const out: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(fallback)) out[key] = merge(fallback, src[key], path);
    else {
      const v = validValue(path, fallback, src[key]);
      out[key] = v === undefined ? fallback : v;
    }
  }
  return out;
}

/** The full rule set for a deck: defaults with the teacher's valid overrides on top. */
export function resolveRules(overrides?: unknown): DeckRules {
  const rules = merge(DEFAULT_RULES as unknown as Record<string, unknown>, overrides, '') as unknown as DeckRules;
  if (!Object.values(rules.modes).some(Boolean)) rules.modes = { ...rules.modes, vocab: true };
  return rules;
}

/** Keep only the rules that differ from the defaults (what a deck stores). */
function diff(defaults: Record<string, unknown>, rules: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    if (isObject(fallback)) {
      const sub = diff(fallback, rules[key] as Record<string, unknown>);
      if (sub) out[key] = sub;
    } else if (rules[key] !== fallback) out[key] = rules[key];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Clean what a teacher sent: drop unknown keys and invalid values, clamp
 * numbers, and keep only real changes from the defaults.
 */
export function cleanOverrides(input: unknown): RuleOverrides {
  return (diff(DEFAULT_RULES as unknown as Record<string, unknown>, resolveRules(input) as unknown as Record<string, unknown>) ?? {}) as RuleOverrides;
}

/** Practice modes a learner can pick, in a fixed order. */
export function enabledModes(rules: DeckRules): SkillMode[] {
  return (['vocab', 'reading', 'listening', 'writing'] as const).filter((m) => rules.modes[m]);
}
