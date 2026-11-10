import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseWords } from './words';

const csv = readFileSync(resolve(__dirname, '../../data/ko_hi_en_vocab.csv'), 'utf8');

describe('parseWords', () => {
  it('uses the Korean headword as a stable id and skips duplicates', () => {
    const words = parseWords('한글,Hindi,English\n가방,थैला,bag\n가방,x,y\n가게,दुकान,"store, shop"');
    expect(words).toEqual([
      { id: '가방', ko: '가방', hi: 'थैला', en: 'bag' },
      { id: '가게', ko: '가게', hi: 'दुकान', en: 'store, shop' },
    ]);
  });

  it('loads the bundled word list with every column filled', () => {
    const words = parseWords(csv);
    expect(words.length).toBeGreaterThan(1600);
    for (const w of words) {
      expect(w.ko, `row ${w.id}`).not.toBe('');
      expect(w.hi, `Hindi for ${w.id}`).not.toBe('');
      expect(w.en, `English for ${w.id}`).not.toBe('');
    }
  });

  it('has Hindi meanings in Devanagari, not machine-translation leftovers', () => {
    const byId = new Map(parseWords(csv).map((w) => [w.id, w]));
    for (const w of byId.values()) {
      expect(w.hi, `Hindi for ${w.id}`).not.toMatch(/[A-Za-z]/);
    }
    // Spot checks for meanings that were translated from the wrong English sense
    expect(byId.get('가게')?.hi).toBe('दुकान');
    expect(byId.get('가볍다')?.hi).toBe('हल्का');
    expect(byId.get('글쎄요')?.hi).toContain('पता नहीं');
    expect(byId.get('켜다')?.hi).toContain('चालू करना');
    expect(byId.get('코트')?.hi).toBe('कोट');
    expect(byId.get('공항')?.hi).toBe('हवाई अड्डा');
    expect(byId.get('은행')?.hi).toBe('बैंक');
  });
});
