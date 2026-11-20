import type { VocabItem } from '../types';

/**
 * Word files in data/plan/ hold one word per line:
 *
 *   ko|romanization|hindi|english|example 1 ko|example 1 hi|example 2 ko|example 2 hi
 *
 * Lines starting with "#" are comments. The first comment of a day-NN file
 * names the study image it came from, e.g. `"Day 20 Clothes, Fashion & Accessories"`.
 * A "#2" after the Korean marks a second word with the same spelling; it is
 * part of the id but not of the word shown.
 */

const FIELDS = 8;

/** The topic named in a day file's header, without the "Day N" prefix. */
export function topicFromHeader(text: string): string | undefined {
  const firstComment = text.split('\n').find((l) => l.startsWith('#'));
  const quoted = firstComment?.match(/"([^"]+)"/)?.[1];
  if (!quoted) return undefined;
  return quoted.replace(/^Day\s+\d+\s*:?\s*/i, '').trim() || undefined;
}

/** Parse one word file. Words from day-NN files are marked as image words. */
export function parsePlanFile(fileName: string, text: string): VocabItem[] {
  const base = fileName.split('/').pop() ?? fileName;
  const source: VocabItem['source'] = base.startsWith('day-') ? 'image' : 'common';
  const topic = source === 'image' ? topicFromHeader(text) : undefined;
  const words: VocabItem[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const f = line.split('|').map((s) => s.trim());
    if (f.length !== FIELDS || !f[0]) continue;
    const [id, rom, hi, en, ko1, hi1, ko2, hi2] = f;
    const examples = [
      { ko: ko1, hi: hi1 },
      { ko: ko2, hi: hi2 },
    ].filter((e) => e.ko && e.hi);
    words.push({ id, ko: id.replace(/#\d+$/, ''), rom, hi, en, examples, source, ...(topic ? { topic } : {}) });
  }
  return words;
}

/**
 * Parse every word file, in file-name order (day-01 … day-20, then fill-01 …).
 * The first file to list an id wins, so a word never appears twice.
 */
export function parsePlanFiles(files: Record<string, string>): VocabItem[] {
  const seen = new Set<string>();
  const words: VocabItem[] = [];
  for (const name of Object.keys(files).sort()) {
    for (const w of parsePlanFile(name, files[name])) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      words.push(w);
    }
  }
  return words;
}

/**
 * Where a Korean example sentence mentions the word, for highlighting.
 * Finds the headword itself, or else the stem of a verb or adjective at the
 * start of a word (먹다 → 먹어요), since conjugation changes the ending.
 * Irregular stems (듣다 → 들어요) are not found, and that is fine: the
 * highlight is a reading aid only.
 */
export function findWordInSentence(sentence: string, ko: string): [number, number] | null {
  const direct = sentence.indexOf(ko);
  if (direct >= 0) return [direct, direct + ko.length];
  if (ko.length >= 2 && ko.endsWith('다')) {
    // 하다 verbs change 하 too (공부하다 → 공부해요), so match the part before it.
    const stem = ko.length > 2 && ko.endsWith('하다') ? ko.slice(0, -2) : ko.slice(0, -1);
    const m = new RegExp(`(^|[\\s"'(])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(sentence);
    if (m) {
      const start = m.index + m[1].length;
      return [start, start + stem.length];
    }
  }
  return null;
}
