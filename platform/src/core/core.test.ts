import { describe, expect, it } from 'vitest';
import { formatCardText, parseCardText } from './cardText';
import { buildQuestion, meaningRelation, pickDistractors } from './quiz';
import { defaultScriptMeta, getScriptAdapter } from './script';
import { answer, currentStep, markMet, pickSessionCards, startSession, summarize } from './session';
import { isValidSlug, normalizeSlug, resolveRoute, slugFromHost } from './tenant';
import { resolveRules } from './rules';
import { newState, review, Rating } from './srs';
import type { Card } from './types';

const card = (id: string, term: string, meaning: string, extra: Partial<Card> = {}): Card => ({ id, deckId: 'd', position: Number(id.replace(/\D/g, '')) || 0, term, meaning, examples: [], moderationStatus: 'active', ...extra });

describe('script adapters', () => {
  it('Hangul: exact, one-letter slip, wrong', () => {
    const ko = getScriptAdapter(defaultScriptMeta('ko'));
    expect(ko.compare('가방', ' 가방 ', false)).toEqual({ correct: true, nearMiss: false });
    expect(ko.compare('가방', '가밤', false)).toEqual({ correct: false, nearMiss: true });
    expect(ko.compare('가방', '학교', false).correct).toBe(false);
    expect(ko.units('학교')).toEqual(['학', '교']);
    expect(ko.guessPos?.('먹다', 'to eat')).toBe('verb');
  });

  it('Latin: accents and case are optional unless strict', () => {
    const es = getScriptAdapter(defaultScriptMeta('es'));
    expect(es.compare('estación', 'Estacion', false).correct).toBe(true);
    expect(es.compare('estación', 'estacion', true).correct).toBe(false);
    expect(es.compare('mañana', 'manana', true)).toEqual({ correct: false, nearMiss: false });
    expect(es.compare('billete', 'bilete', false).nearMiss).toBe(true);
    expect(es.compare('to see, to watch', 'to watch', false).correct).toBe(true);
  });

  it('Devanagari: vowel signs are never stripped', () => {
    const hi = getScriptAdapter(defaultScriptMeta('hi'));
    expect(hi.compare('पानी', 'पानी', false).correct).toBe(true);
    expect(hi.compare('पानी', 'पन', false).correct).toBe(false);
    expect(hi.units('पानी')).toEqual(['पा', 'नी']);
  });
});

describe('quiz engine (ported from the Korean app)', () => {
  const ko = getScriptAdapter(defaultScriptMeta('ko'));
  const pool = [card('c1', '가게', 'store, shop'), card('c2', '상점', 'shop'), card('c3', '학교', 'school'), card('c4', '학생', 'student'), card('c5', '물', 'water'), card('c6', '책', 'book')];

  it('never offers a synonym as a wrong option', () => {
    expect(meaningRelation('store, shop', 'shop')).toBe('same');
    for (let i = 0; i < 50; i++) expect(pickDistractors(pool[0], pool, ko).map((c) => c.id)).not.toContain('c2');
  });

  it('builds four options with the answer, or leaves it out for "Not in the list"', () => {
    const shown = buildQuestion(pool[2], pool, ko, { random: () => 0.9 });
    expect(shown.answerShown).toBe(true);
    expect(shown.options).toHaveLength(4);
    expect(shown.options.map((o) => o.id)).toContain('c3');
    const missing = buildQuestion(pool[2], pool, ko, { allowMissing: true, random: () => 0.1 });
    expect(missing.answerShown).toBe(false);
    expect(missing.options.map((o) => o.id)).not.toContain('c3');
  });
});

describe('practice session', () => {
  const rules = resolveRules({ targetReps: 2 });
  const cards = [card('c1', 'a', 'A'), card('c2', 'b', 'B'), card('c3', 'c', 'C')];

  it('picks due words first, then new words in order', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const due = { ...newState(now), due: '2026-01-09T00:00:00Z' };
    const later = { ...newState(now), due: '2026-02-01T00:00:00Z' };
    const progress = new Map([
      ['c3', due],
      ['c1', later],
    ]);
    expect(pickSessionCards(cards, progress, 2, now)).toEqual(['c3', 'c2']);
    expect(pickSessionCards(cards, progress, 5, now)).toEqual(['c3', 'c2', 'c1']);
  });

  it('shows new words first, needs targetReps right answers, then drills misses', () => {
    let s = startSession(['c1', 'c2'], new Map(), rules, 'vocab', 0);
    expect(currentStep(s)).toEqual({ kind: 'meet', cardId: 'c1' });
    s = markMet(s);
    expect(currentStep(s)).toEqual({ kind: 'meet', cardId: 'c2' });
    s = markMet(s);
    let firstAnswers = 0;
    let missedOnce = false;
    for (let i = 0; i < 30 && currentStep(s).kind !== 'done'; i++) {
      const step = currentStep(s);
      const outcome = step.kind === 'question' && step.cardId === 'c2' && !missedOnce ? 'wrong' : 'right';
      if (outcome === 'wrong') missedOnce = true;
      const r = answer(s, outcome, rules, 1000);
      if (r.firstAnswer) firstAnswers++;
      s = r.state;
    }
    expect(s.phase).toBe('done');
    expect(firstAnswers).toBe(2);
    expect(s.missed).toEqual(['c2']);
    const sum = summarize(s);
    expect(sum.words).toBe(2);
    expect(sum.accuracy).toBe(50);
  });

  it('always ends, even if every answer is wrong', () => {
    let s = startSession(['c1', 'c2', 'c3'], new Map([['c1', newState(new Date())], ['c2', newState(new Date())], ['c3', newState(new Date())]]), rules, 'writing');
    for (let i = 0; i < 100 && currentStep(s).kind !== 'done'; i++) s = answer(s, 'wrong', rules).state;
    expect(currentStep(s).kind).toBe('done');
  });
});

describe('creator slugs and routing', () => {
  it('reads creator subdomains', () => {
    expect(slugFromHost('ravi.localhost:5173', 'localhost')).toBe('ravi');
    expect(slugFromHost('localhost:5173', 'localhost')).toBeNull();
    expect(slugFromHost('www.vocab.example.com', 'vocab.example.com')).toBeNull();
    expect(slugFromHost('a.b.localhost', 'localhost')).toBeNull();
  });

  it('routes codes, @slugs and creator subdomains', () => {
    expect(resolveRoute('localhost', '/a7k9', 'localhost')).toEqual({ kind: 'deck', code: 'A7K9' });
    expect(resolveRoute('localhost', '/p/A7K9', 'localhost')).toEqual({ kind: 'deck', code: 'A7K9' });
    expect(resolveRoute('localhost', '/@Ravi', 'localhost')).toEqual({ kind: 'creator', slug: 'ravi' });
    expect(resolveRoute('ravi.localhost', '/', 'localhost')).toEqual({ kind: 'creator', slug: 'ravi' });
    expect(resolveRoute('localhost', '/docs', 'localhost')).toEqual({ kind: 'app' });
  });

  it('keeps slugs safe for subdomains', () => {
    expect(normalizeSlug('Ravi Sharma!')).toBe('ravi-sharma');
    expect(isValidSlug('ravi')).toBe(true);
    expect(isValidSlug('api')).toBe(false);
    expect(isValidSlug('-x-')).toBe(false);
  });
});

describe('card text and scheduling', () => {
  it('parses one card per line and formats it back', () => {
    const { cards, errors } = parseCardText('# note\n물 | water | mul | 물 좀 주세요. | Water, please.\n\n학교\tschool\nbroken line');
    expect(errors).toEqual([{ line: 5, message: expect.stringMatching(/at least a word/) }]);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ term: '물', meaning: 'water', reading: 'mul', examples: [{ text: '물 좀 주세요.', translation: 'Water, please.' }] });
    expect(parseCardText(formatCardText(cards)).cards).toEqual(cards);
  });

  it('schedules a remembered word further out than a forgotten one', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const good = review(undefined, Rating.Good, now);
    const again = review(undefined, Rating.Again, now);
    expect(Date.parse(good.due)).toBeGreaterThan(Date.parse(again.due));
  });
});
