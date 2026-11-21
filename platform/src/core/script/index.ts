/**
 * Script adapters: the only place that knows how a writing system behaves.
 *
 * The quiz and writing checks call these instead of assuming Korean, so a
 * deck in any language works. Add an adapter here when a script needs
 * special handling (Hangul compares by letter inside each syllable block).
 */
import type { ScriptMeta } from '../types';
import { editDistance, normalizeHangul, toJamo } from './hangul';

export interface TypedResult {
  correct: boolean;
  /** Off by one letter: counted as a small slip, not a miss. */
  nearMiss: boolean;
}

export interface ScriptAdapter {
  id: string;
  /** Canonical form used to compare answers. `strict` keeps accents and case. */
  normalize(text: string, strict: boolean): string;
  /** Compare a typed answer with the expected one. */
  compare(expected: string, typed: string, strict: boolean): TypedResult;
  /** Building blocks for tap-to-write tiles: syllables for Hangul, letters elsewhere. */
  units(text: string): string[];
  /** How much two terms look or sound alike, roughly 0 to 4. Used to pick hard wrong options. */
  lookAlike(a: string, b: string): number;
  /** Guess the part of speech when a card does not say. */
  guessPos?(term: string, meaning: string): string | undefined;
}

/** Split text into user-perceived characters (keeps é, 가, क्ष together). */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return [...text];
  return [...new Seg(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
}

/** Scripts where accents are marks a beginner may not be able to type. */
const ACCENT_FOLD_SCRIPTS = new Set(['Latn', 'Cyrl', 'Grek']);

const answerVariants = (expected: string) =>
  // "to see, to watch" accepts either; a note in brackets is not required.
  [expected, ...expected.split(/[,;/]/)].map((s) => s.replace(/\(.*?\)/g, '').trim()).filter(Boolean);

function genericAdapter(meta: ScriptMeta): ScriptAdapter {
  const fold = ACCENT_FOLD_SCRIPTS.has(meta.script);
  const normalize = (text: string, strict: boolean) => {
    let t = text.normalize('NFC').replace(/[\s​]+/g, ' ').trim().replace(/[.!?。！？]+$/u, '');
    if (!strict && !meta.caseSensitive) t = t.toLowerCase();
    if (!strict && fold) t = t.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
    return t;
  };
  return {
    id: 'generic',
    normalize,
    compare(expected, typed, strict) {
      const got = normalize(typed, strict);
      if (!got) return { correct: false, nearMiss: false };
      let best = Infinity;
      for (const want of answerVariants(expected).map((v) => normalize(v, strict))) {
        if (want === got) return { correct: true, nearMiss: false };
        const g = graphemes(want);
        // A one-letter slip only counts on words of 3+ letters, and never in strict mode.
        if (!strict && g.length >= 3) best = Math.min(best, graphemeDistance(g, graphemes(got)));
      }
      return { correct: false, nearMiss: best === 1 };
    },
    units: (text) => graphemes(text.replace(/\s+/g, '')),
    lookAlike(a, b) {
      const ga = graphemes(normalize(a, false));
      const gb = graphemes(normalize(b, false));
      const sa = new Set(ga);
      const shared = [...new Set(gb)].filter((ch) => sa.has(ch)).length;
      const closeness = 1 - graphemeDistance(ga, gb) / Math.max(ga.length, gb.length, 1);
      return Math.min(shared / 2, 2) + (closeness >= 0.6 ? 1 : 0) + (ga[0] === gb[0] ? 0.5 : 0) + (ga.length === gb.length ? 0.5 : 0);
    },
  };
}

/** Edit distance over grapheme lists. */
export function graphemeDistance(a: readonly string[], b: readonly string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const hangulAdapter: ScriptAdapter = {
  id: 'hangul',
  normalize: (text) => normalizeHangul(text).replace(/[.!?]+$/, ''),
  compare(expected, typed) {
    const got = normalizeHangul(typed).replace(/[.!?]+$/, '');
    if (!got) return { correct: false, nearMiss: false };
    let best = Infinity;
    for (const v of answerVariants(expected)) {
      const want = normalizeHangul(v);
      if (want === got) return { correct: true, nearMiss: false };
      best = Math.min(best, editDistance(toJamo(want), toJamo(got)));
    }
    return { correct: false, nearMiss: best === 1 };
  },
  units: (text) => [...normalizeHangul(text)],
  lookAlike(a, b) {
    // From the Korean app's quiz: shared syllables, or a small difference in letters.
    const sa = new Set(a);
    const sharedSyllables = [...new Set(b)].filter((ch) => sa.has(ch)).length;
    const ja = toJamo(a);
    const jb = toJamo(b);
    const closeness = 1 - editDistance(ja, jb) / Math.max(ja.length, jb.length, 1);
    return Math.min(sharedSyllables, 2) + (closeness >= 0.6 ? 1 : 0) + (a[0] === b[0] ? 0.5 : 0) + (a.length === b.length ? 0.5 : 0);
  },
  guessPos(term, meaning) {
    // Korean verbs and adjectives end in 다; "to be …" glosses are adjectives.
    if (!term.endsWith('다')) return 'noun';
    const m = meaning.trim().toLowerCase();
    return m.startsWith('to ') && !m.startsWith('to be ') ? 'verb' : 'adjective';
  },
};

export function getScriptAdapter(meta: ScriptMeta): ScriptAdapter {
  if (meta.script === 'Hang' || meta.script === 'Kore') return hangulAdapter;
  return genericAdapter(meta);
}

/** Sensible script settings for common target languages; anything else gets Latin defaults. */
export function defaultScriptMeta(targetLang: string): ScriptMeta {
  const lang = targetLang.toLowerCase().split('-')[0];
  const table: Record<string, ScriptMeta> = {
    ko: { script: 'Hang', direction: 'ltr', readingLabel: 'Romanization' },
    ja: { script: 'Jpan', direction: 'ltr', readingLabel: 'Romaji' },
    zh: { script: 'Hani', direction: 'ltr', readingLabel: 'Pinyin' },
    hi: { script: 'Deva', direction: 'ltr', readingLabel: 'Transliteration' },
    mr: { script: 'Deva', direction: 'ltr', readingLabel: 'Transliteration' },
    ne: { script: 'Deva', direction: 'ltr', readingLabel: 'Transliteration' },
    ar: { script: 'Arab', direction: 'rtl', readingLabel: 'Transliteration' },
    ur: { script: 'Arab', direction: 'rtl', readingLabel: 'Transliteration' },
    fa: { script: 'Arab', direction: 'rtl', readingLabel: 'Transliteration' },
    he: { script: 'Hebr', direction: 'rtl', readingLabel: 'Transliteration' },
    ru: { script: 'Cyrl', direction: 'ltr', readingLabel: 'Transliteration' },
    uk: { script: 'Cyrl', direction: 'ltr', readingLabel: 'Transliteration' },
    el: { script: 'Grek', direction: 'ltr', readingLabel: 'Transliteration' },
    th: { script: 'Thai', direction: 'ltr', readingLabel: 'Transliteration' },
    ta: { script: 'Taml', direction: 'ltr', readingLabel: 'Transliteration' },
    bn: { script: 'Beng', direction: 'ltr', readingLabel: 'Transliteration' },
  };
  return table[lang] ?? { script: 'Latn', direction: 'ltr', readingLabel: 'Pronunciation' };
}
