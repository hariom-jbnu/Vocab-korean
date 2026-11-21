/**
 * 4-character deck codes such as A7K9.
 *
 * The alphabet leaves out characters that are easy to mix up when a code is
 * read aloud in a video or typed from a screenshot: 0/O, 1/I/L. That leaves
 * 31 characters, so there are 31^4 = 923,521 codes.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;
export const CODE_SPACE = CODE_ALPHABET.length ** CODE_LENGTH;

/** Codes that spell something rude are never handed out. */
const BLOCKED = new Set(['FUCK', 'FUKK', 'CUNT', 'DICK', 'COCK', 'PUSY', 'SEXX', 'SEXY', 'PORN', 'RAPE', 'NAZZ', 'KKKK', 'SHAT', 'TWAT', 'FAGG', 'DAMN', 'HATE', 'KYS2']);

/** Uppercase, and drop spaces and dashes, so "a7k-9" works like "A7K9". */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Why a typed code is not valid, in words a learner understands, or null when it is fine. */
export function codeProblem(input: string): string | null {
  const code = normalizeCode(input);
  if (code.length !== CODE_LENGTH) return `A code has ${CODE_LENGTH} characters.`;
  if (/[0O1IL]/.test(code)) return 'Codes never use 0, O, 1, I or L. Check the code again.';
  if (!isValidCode(code)) return 'Codes use only letters and the numbers 2 to 9.';
  return null;
}

export function isBlockedCode(code: string): boolean {
  return BLOCKED.has(code);
}

/** Returns a random integer in [0, max). Injected in tests. */
export type RandomInt = (max: number) => number;

const cryptoRandomInt: RandomInt = (max) => {
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
};

export function randomCode(randomInt: RandomInt = cryptoRandomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export class CodeSpaceExhaustedError extends Error {
  constructor(attempts: number) {
    super(`Could not find a free deck code after ${attempts} tries.`);
    this.name = 'CodeSpaceExhaustedError';
  }
}

/**
 * Draw random codes until one is free. `isTaken` asks the store; the store's
 * unique index is the final guard if two decks are created at the same moment.
 */
export async function generateUniqueCode(
  isTaken: (code: string) => boolean | Promise<boolean>,
  { randomInt = cryptoRandomInt, maxAttempts = 50 }: { randomInt?: RandomInt; maxAttempts?: number } = {}
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomCode(randomInt);
    if (isBlockedCode(code)) continue;
    if (!(await isTaken(code))) return code;
  }
  throw new CodeSpaceExhaustedError(maxAttempts);
}
