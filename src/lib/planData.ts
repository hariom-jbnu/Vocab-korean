import { parsePlanFiles } from './planWords';

/**
 * The 2,000 words with their examples. This module is loaded on demand (see
 * useVocab) so the word files ship as their own chunk, not in the first
 * download.
 */
const files = import.meta.glob('../../data/plan/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export const PLAN_WORDS = parsePlanFiles(files);
