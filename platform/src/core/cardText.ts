/**
 * Cards as plain text, one card per line, so a teacher can paste a word list
 * from a spreadsheet or notes:
 *
 *   term | meaning | reading | example | example translation | meaning 2 | writing prompt
 *
 * Only term and meaning are required. Tabs work instead of "|", so a range
 * copied from a spreadsheet pastes straight in. Lines starting with # are notes.
 */
import type { Example } from './types';

export interface CardDraft {
  id?: string;
  term: string;
  meaning: string;
  reading?: string;
  meaningAlt?: string;
  examples: Example[];
  writingPrompt?: string;
}

export const CARD_TEXT_COLUMNS = ['term', 'meaning', 'reading', 'example', 'example translation', 'meaning 2', 'writing prompt'] as const;

export interface ParsedCards {
  cards: CardDraft[];
  /** Lines that could not be read, with the reason. 1-based line numbers. */
  errors: { line: number; message: string }[];
}

export const MAX_CARDS = 500;
const MAX_FIELD = 300;

export function parseCardText(text: string): ParsedCards {
  const cards: CardDraft[] = [];
  const errors: ParsedCards['errors'] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const cols = (line.includes('\t') ? line.split('\t') : line.split('|')).map((c) => c.trim());
    const [term, meaning, reading, example, translation, meaningAlt, prompt] = cols;
    if (!term || !meaning) {
      errors.push({ line: i + 1, message: 'Needs at least a word and its meaning, separated by |' });
      return;
    }
    if (cols.some((c) => c.length > MAX_FIELD)) {
      errors.push({ line: i + 1, message: `A field is longer than ${MAX_FIELD} characters.` });
      return;
    }
    if (cards.length >= MAX_CARDS) {
      errors.push({ line: i + 1, message: `A deck holds at most ${MAX_CARDS} cards.` });
      return;
    }
    cards.push({
      term,
      meaning,
      reading: reading || undefined,
      examples: example ? [{ text: example, translation: translation || undefined }] : [],
      meaningAlt: meaningAlt || undefined,
      writingPrompt: prompt || undefined,
    });
  });
  return { cards, errors };
}

/** The reverse of parseCardText, for the editor. Extra examples beyond the first are not shown. */
export function formatCardText(cards: readonly CardDraft[]): string {
  return cards
    .map((c) => {
      const ex = c.examples[0];
      const cols = [c.term, c.meaning, c.reading ?? '', ex?.text ?? '', ex?.translation ?? '', c.meaningAlt ?? '', c.writingPrompt ?? ''];
      while (cols.length > 2 && !cols[cols.length - 1]) cols.pop();
      return cols.join(' | ');
    })
    .join('\n');
}
