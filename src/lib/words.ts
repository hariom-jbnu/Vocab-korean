import { parseCsvObjects } from './csv';
import type { VocabItem } from '../types';

/**
 * Turn the word list CSV into vocabulary items.
 *
 * The Korean headword is the stable id: it is unique in the list and does not
 * change when rows are re-ordered or meanings are corrected, so saved progress
 * keeps pointing at the right word.
 */
export function parseWords(csvText: string): VocabItem[] {
  const seen = new Set<string>();
  const words: VocabItem[] = [];

  for (const row of parseCsvObjects(csvText)) {
    const ko = row['한글'] ?? row['ko'] ?? '';
    if (!ko || seen.has(ko)) continue;
    seen.add(ko);
    words.push({
      id: ko,
      ko,
      hi: row['Hindi'] ?? row['hi'] ?? '',
      en: row['English'] ?? row['en'] ?? '',
    });
  }

  return words;
}
