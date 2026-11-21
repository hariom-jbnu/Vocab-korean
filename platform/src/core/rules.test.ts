import { describe, expect, it } from 'vitest';
import { cleanOverrides, DEFAULT_RULES, enabledModes, resolveRules } from './rules';

describe('deck rules', () => {
  it('starts every deck on the beginner defaults', () => {
    const r = resolveRules({});
    expect(r).toEqual(DEFAULT_RULES);
    expect(r.answerStyle).toBe('recall-first');
    expect(r.notInList).toBe(true);
    expect(r.writing.level).toBe('guided');
    expect(r.reading.hints).toBe('tap');
    expect(enabledModes(r)).toEqual(['vocab', 'reading', 'listening', 'writing']);
    expect(resolveRules(undefined)).toEqual(DEFAULT_RULES);
    expect(resolveRules('nonsense')).toEqual(DEFAULT_RULES);
  });

  it('applies a teacher override and keeps every other default', () => {
    const r = resolveRules({ writing: { level: 'strict' }, modes: { listening: false }, targetReps: 3 });
    expect(r.writing.level).toBe('strict');
    expect(r.writing.prompts).toBe(true);
    expect(r.modes).toEqual({ vocab: true, reading: true, listening: false, writing: true });
    expect(r.targetReps).toBe(3);
    expect(r.endOfSession).toEqual(DEFAULT_RULES.endOfSession);
  });

  it('ignores invalid values and unknown keys', () => {
    const r = resolveRules({ answerStyle: 'telepathy', notInList: 'yes', reading: { hints: 'sometimes' }, hacker: true });
    expect(r.answerStyle).toBe('recall-first');
    expect(r.notInList).toBe(true);
    expect(r.reading.hints).toBe('tap');
    expect(r).not.toHaveProperty('hacker');
  });

  it('clamps numbers into their allowed range', () => {
    const r = resolveRules({ targetReps: 99, wordsPerSession: 1, listening: { speed: 9, gapSeconds: -2 } });
    expect(r.targetReps).toBe(5);
    expect(r.wordsPerSession).toBe(3);
    expect(r.listening.speed).toBe(1.5);
    expect(r.listening.gapSeconds).toBe(0);
    expect(resolveRules({ targetReps: 2.6 }).targetReps).toBe(3);
  });

  it('keeps at least one practice mode on', () => {
    const r = resolveRules({ modes: { vocab: false, reading: false, listening: false, writing: false } });
    expect(enabledModes(r)).toEqual(['vocab']);
  });

  it('stores only real changes, so improved defaults reach old decks', () => {
    expect(cleanOverrides(DEFAULT_RULES)).toEqual({});
    expect(cleanOverrides({ ...DEFAULT_RULES, notInList: false })).toEqual({ notInList: false });
    expect(cleanOverrides({ writing: { level: 'strict', prompts: true }, junk: 1 })).toEqual({ writing: { level: 'strict' } });
    expect(cleanOverrides({ targetReps: 50 })).toEqual({ targetReps: 5 });
  });

  it('round-trips: resolving stored overrides gives back the same rules', () => {
    const wanted = resolveRules({ answerStyle: 'options', listening: { speed: 0.75 }, endOfSession: { summary: false } });
    expect(resolveRules(cleanOverrides(wanted))).toEqual(wanted);
  });
});
