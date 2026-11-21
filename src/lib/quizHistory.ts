import { loadJson, saveJson } from './storage';

/**
 * Small per-word notes kept in this browser:
 * - the wrong options each word showed lately, so they do not come back for its next 5 questions
 * - production misses in a row (typing, picking the Korean)
 */
const DISTRACTORS_KEY = 'quiz:distractors';
const MISSES_KEY = 'quiz:production-misses';

/** Questions a wrong option stays out of after being shown. */
export const AVOID_FOR = 5;

type DistractorLog = Record<string, string[][]>;

export function recentDistractors(wordId: string): Set<string> {
  const log = loadJson<DistractorLog>(DISTRACTORS_KEY, {});
  return new Set((log[wordId] ?? []).flat());
}

export function rememberDistractors(wordId: string, ids: readonly string[]): void {
  const log = loadJson<DistractorLog>(DISTRACTORS_KEY, {});
  log[wordId] = [...(log[wordId] ?? []), [...ids]].slice(-AVOID_FOR);
  saveJson(DISTRACTORS_KEY, log);
}

export function productionMisses(wordId: string): number {
  return loadJson<Record<string, number>>(MISSES_KEY, {})[wordId] ?? 0;
}

export function setProductionMisses(wordId: string, n: number): void {
  const misses = loadJson<Record<string, number>>(MISSES_KEY, {});
  if (n > 0) misses[wordId] = n;
  else delete misses[wordId];
  saveJson(MISSES_KEY, misses);
}
