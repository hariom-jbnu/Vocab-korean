import { describe, expect, it } from 'vitest';
import { ThemeType, type Settings } from '../types';
import { createScheduler, newCard, rate, Rating } from './srs';
import { applyRemoteSettings, cardToRow, chunk, reviewToRow, rowToCard, rowToReview, syncedSettings } from './syncData';

const now = new Date('2026-11-10T10:00:00Z');

const settings: Settings = {
  voiceName: 'Yuna',
  rate: 0.8,
  pitch: 1,
  autoSpeak: false,
  theme: ThemeType.NAVY,
  isRandom: false,
  cardBg: '#FFFFFF',
  newPerDay: 10,
  dailyGoal: 20,
  retention: 0.9,
  seed: 1,
  answerMode: 'quiz',
  typeAnswers: true,
};

describe('sync rows', () => {
  it('round-trips a card', () => {
    const { card } = rate(createScheduler(), newCard('가방', now), Rating.Good, now);
    const stamped = { ...card, updatedAt: now.getTime() };
    const back = rowToCard(cardToRow(stamped));
    expect(back).toEqual({ ...stamped, id: '가방' });
  });

  it('round-trips an answer', () => {
    const { record } = rate(createScheduler(), newCard('가방', now), Rating.Hard, now, 1234.6);
    const withUid = { ...record, uid: '11111111-1111-4111-8111-111111111111' };
    const row = reviewToRow(withUid, 'user-1');
    expect(row).toMatchObject({ user_id: 'user-1', id: withUid.uid, word_id: '가방', rating: Rating.Hard, duration_ms: 1235 });
    expect(rowToReview(row)).toEqual({ ...withUid, durationMs: 1235 });
  });

  it('refuses an answer without a shared id', () => {
    const { record } = rate(createScheduler(), newCard('가방', now), Rating.Good, now);
    expect(() => reviewToRow(record, 'user-1')).toThrow();
  });
});

describe('synced settings', () => {
  it('leaves out device-only settings', () => {
    expect(syncedSettings(settings)).not.toHaveProperty('voiceName');
    expect(syncedSettings(settings)).toMatchObject({ newPerDay: 10, seed: 1 });
  });

  it('applies remote settings but keeps this device voice and skips bad values', () => {
    const merged = applyRemoteSettings(settings, {
      voiceName: 'Other',
      newPerDay: 20,
      dailyGoal: 'lots' as unknown as number,
      unknownField: true,
    } as Partial<Settings>);
    expect(merged).toEqual({ ...settings, newPerDay: 20 });
  });
});

describe('chunk', () => {
  it('splits a list', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
