import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects } from './csv';

describe('parseCsv', () => {
  it('splits simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quotes', () => {
    expect(parseCsv('가게,दुकान,"store, shop"')).toEqual([['가게', 'दुकान', 'store, shop']]);
  });

  it('handles escaped quotes and newlines inside quotes', () => {
    expect(parseCsv('"say ""hi""","line1\nline2"')).toEqual([['say "hi"', 'line1\nline2']]);
  });

  it('keeps empty fields so columns do not shift', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c']]);
    expect(parseCsv('a,,c\nx,,z')).toEqual([
      ['a', '', 'c'],
      ['x', '', 'z'],
    ]);
  });

  it('handles CRLF, a BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseCsvObjects', () => {
  it('maps rows to header keys and trims values', () => {
    expect(parseCsvObjects('한글,Hindi,English\n 가방 ,थैला,bag')).toEqual([
      { 한글: '가방', Hindi: 'थैला', English: 'bag' },
    ]);
  });
});
