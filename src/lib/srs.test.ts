import { describe, expect, it } from 'vitest';
import { createScheduler, formatInterval, newCard, previewDue, rate, Rating, State, clampRetention } from './srs';

const now = new Date('2026-11-10T10:00:00Z');

describe('srs', () => {
  it('starts words as new cards keyed by word id', () => {
    const card = newCard('가방', now);
    expect(card.id).toBe('가방');
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
  });

  it('moves a new card into learning on Good and records the answer', () => {
    const s = createScheduler();
    const { card, record } = rate(s, newCard('가방', now), Rating.Good, now, 2345.6);
    expect(card.id).toBe('가방');
    expect(card.state).toBe(State.Learning);
    expect(card.due.getTime()).toBeGreaterThan(now.getTime());
    expect(record).toMatchObject({ wordId: '가방', rating: Rating.Good, state: State.New, durationMs: 2346 });
  });

  it('schedules Easy further out than Good, Good further than Hard, Hard further than Again', () => {
    const s = createScheduler();
    const due = previewDue(s, newCard('가방', now), now);
    expect(due[Rating.Easy].getTime()).toBeGreaterThan(due[Rating.Good].getTime());
    expect(due[Rating.Good].getTime()).toBeGreaterThan(due[Rating.Hard].getTime());
    expect(due[Rating.Hard].getTime()).toBeGreaterThan(due[Rating.Again].getTime());
  });

  it('grows the interval after repeated successful reviews', () => {
    const s = createScheduler();
    let card = newCard('가방', now);
    let t = now;
    const gaps: number[] = [];
    for (let i = 0; i < 5; i++) {
      card = rate(s, card, Rating.Good, t).card;
      gaps.push(card.due.getTime() - t.getTime());
      t = card.due;
    }
    expect(card.state).toBe(State.Review);
    expect(gaps[4]).toBeGreaterThan(gaps[2]);
  });

  it('formats intervals compactly', () => {
    const at = (ms: number) => new Date(now.getTime() + ms);
    expect(formatInterval(now, at(30_000))).toBe('<1m');
    expect(formatInterval(now, at(10 * 60_000))).toBe('10m');
    expect(formatInterval(now, at(3 * 3600_000))).toBe('3h');
    expect(formatInterval(now, at(4 * 86400_000))).toBe('4d');
    expect(formatInterval(now, at(60 * 86400_000))).toBe('2mo');
    expect(formatInterval(now, at(548 * 86400_000))).toBe('1.5y');
  });

  it('keeps desired retention in a safe range', () => {
    expect(clampRetention(0.5)).toBe(0.7);
    expect(clampRetention(0.99)).toBe(0.97);
    expect(clampRetention(Number.NaN)).toBe(0.9);
  });
});
