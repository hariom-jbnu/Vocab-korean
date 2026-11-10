import { describe, expect, it } from 'vitest';
import { checkTyped, decompose, editDistance, normalizeHangul, toJamo } from './hangul';

describe('decompose', () => {
  it('splits syllables into initial, vowel and final', () => {
    expect(decompose('가')).toEqual(['ㄱ', 'ㅏ']);
    expect(decompose('방')).toEqual(['ㅂ', 'ㅏ', 'ㅇ']);
    expect(decompose('읽')).toEqual(['ㅇ', 'ㅣ', 'ㄺ']);
    expect(decompose('a')).toEqual(['a']);
  });

  it('turns words into letters', () => {
    expect(toJamo('가방')).toBe('ㄱㅏㅂㅏㅇ');
  });
});

describe('normalizeHangul', () => {
  it('composes separate jamo and drops spaces', () => {
    // 가 written as conjoining jamo U+1100 U+1161
    expect(normalizeHangul(' 가방 ')).toBe('가방');
    expect(normalizeHangul('처음 뵙겠습니다')).toBe('처음뵙겠습니다');
  });
});

describe('editDistance', () => {
  it('counts single-letter edits', () => {
    expect(editDistance('ㄱㅏㅂㅏㅇ', 'ㄱㅏㅂㅏㅁ')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'ab')).toBe(2);
  });
});

describe('checkTyped', () => {
  it('accepts an exact answer', () => {
    expect(checkTyped('가방', '가방')).toMatchObject({ correct: true, nearMiss: false });
  });

  it('flags a one-letter slip as a near miss and marks the wrong block', () => {
    const r = checkTyped('가방', '가밤');
    expect(r.correct).toBe(false);
    expect(r.nearMiss).toBe(true);
    expect(r.blocks).toEqual([
      { char: '가', status: 'ok' },
      { char: '방', status: 'wrong' },
    ]);
  });

  it('marks missing syllables and does not call an empty answer a near miss', () => {
    expect(checkTyped('가방', '가').blocks[1].status).toBe('missing');
    expect(checkTyped('가', '').nearMiss).toBe(false);
  });

  it('treats a different word as wrong', () => {
    expect(checkTyped('가방', '학교')).toMatchObject({ correct: false, nearMiss: false });
  });
});
