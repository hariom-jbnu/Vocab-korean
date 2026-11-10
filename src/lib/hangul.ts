/**
 * Hangul helpers for checking typed answers.
 *
 * Every precomposed syllable (U+AC00 to U+D7A3) is built from an initial
 * consonant, a vowel and an optional final consonant:
 *   code = 0xAC00 + (initial * 21 + vowel) * 28 + final
 * Splitting syllables into these letters (jamo) lets us show which part of
 * a block was wrong: 가방 typed as 가밤 differs only in the final ㅇ/ㅁ.
 */
const BASE = 0xac00;
const LAST = 0xd7a3;

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function isSyllable(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= BASE && c <= LAST;
}

/** Split one syllable into [initial, vowel, final]; other characters come back as-is. */
export function decompose(ch: string): string[] {
  if (!isSyllable(ch)) return [ch];
  const code = ch.codePointAt(0)! - BASE;
  const initial = Math.floor(code / 588);
  const vowel = Math.floor((code % 588) / 28);
  const final = code % 28;
  return final ? [INITIALS[initial], VOWELS[vowel], FINALS[final]] : [INITIALS[initial], VOWELS[vowel]];
}

/** Letters of a whole string, e.g. 가방 -> ㄱㅏㅂㅏㅇ. */
export function toJamo(text: string): string {
  return [...text].flatMap(decompose).join('');
}

/** Trim, drop spaces and compose to NFC so different keyboards compare equal. */
export function normalizeHangul(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, '').trim();
}

/** Edit distance between two strings, counting single letters. */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

export type BlockStatus = 'ok' | 'wrong' | 'missing';

export interface TypedCheck {
  correct: boolean;
  /** Off by one letter (jamo), such as 가밤 for 가방. */
  nearMiss: boolean;
  /** Each syllable of the expected word and whether the learner got it. */
  blocks: { char: string; status: BlockStatus }[];
}

export function checkTyped(expected: string, typed: string): TypedCheck {
  const want = normalizeHangul(expected);
  const got = normalizeHangul(typed);
  const correct = want === got;
  const distance = editDistance(toJamo(want), toJamo(got));
  const gotChars = [...got];
  const blocks = [...want].map((char, i) => ({
    char,
    status: (gotChars[i] === undefined ? 'missing' : gotChars[i] === char ? 'ok' : 'wrong') as BlockStatus,
  }));
  return { correct, nearMiss: !correct && got.length > 0 && distance === 1, blocks };
}
