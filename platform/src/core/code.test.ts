import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_SPACE, CodeSpaceExhaustedError, codeProblem, generateUniqueCode, isBlockedCode, isValidCode, normalizeCode, randomCode } from './code';

/** A random source that returns the given character indexes in order. */
const scripted = (indexes: number[]) => {
  let i = 0;
  return () => indexes[i++ % indexes.length];
};
const indexesOf = (code: string) => [...code].map((ch) => CODE_ALPHABET.indexOf(ch));

describe('deck codes', () => {
  it('uses 4 characters without look-alikes (0 O 1 I L)', () => {
    expect(CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    expect(CODE_SPACE).toBe(31 ** 4);
    for (let i = 0; i < 500; i++) {
      const c = randomCode();
      expect(c).toHaveLength(4);
      expect(isValidCode(c)).toBe(true);
    }
  });

  it('normalizes what people type', () => {
    expect(normalizeCode(' a7k-9 ')).toBe('A7K9');
    expect(normalizeCode('a 7 k 9')).toBe('A7K9');
    expect(isValidCode('A7K9')).toBe(true);
    expect(isValidCode('A7K')).toBe(false);
    expect(isValidCode('A0K9')).toBe(false);
  });

  it('explains a bad code in plain words', () => {
    expect(codeProblem('a7k9')).toBeNull();
    expect(codeProblem('A7K')).toMatch(/4 characters/);
    expect(codeProblem('K0RE')).toMatch(/never use 0, O, 1, I or L/);
    expect(codeProblem('A7K#')).toMatch(/only letters/);
  });

  it('skips taken codes and returns a free one', async () => {
    const taken = new Set(['AAAA', 'BBBB']);
    const code = await generateUniqueCode((c) => taken.has(c), { randomInt: scripted([...indexesOf('AAAA'), ...indexesOf('BBBB'), ...indexesOf('A7K9')]) });
    expect(code).toBe('A7K9');
  });

  it('never hands out a blocked word', async () => {
    expect(isBlockedCode('FUCK')).toBe(true);
    const code = await generateUniqueCode(() => false, { randomInt: scripted([...indexesOf('FUCK'), ...indexesOf('ZZ22')]) });
    expect(code).toBe('ZZ22');
  });

  it('gives up with a clear error when every try is taken', async () => {
    await expect(generateUniqueCode(() => true, { maxAttempts: 5 })).rejects.toBeInstanceOf(CodeSpaceExhaustedError);
  });

  it('produces unique codes across many decks', async () => {
    const taken = new Set<string>();
    for (let i = 0; i < 3000; i++) taken.add(await generateUniqueCode((c) => taken.has(c)));
    expect(taken.size).toBe(3000);
  });
});
