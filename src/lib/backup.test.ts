import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { backupFileName, createBackup, parseBackup } from './backup';
import { clearProgress, closeDb, getAllCards, getAllReviews, replaceProgress, saveAnswer } from './db';
import { createScheduler, newCard, rate, Rating } from './srs';
import { ThemeType, type Settings } from '../types';

const now = new Date('2026-11-10T10:00:00Z');
const settings: Settings = {
  voiceName: '', rate: 0.8, pitch: 1, autoSpeak: false, theme: ThemeType.NAVY, isRandom: false, cardBg: '#FFFFFF',
  newPerDay: 10, dailyGoal: 20, retention: 0.9, seed: 1, answerMode: 'quiz', typeAnswers: true,
};

afterEach(async () => {
  await clearProgress();
  await closeDb();
});

describe('backup', () => {
  it('round-trips cards and reviews through JSON with real dates', async () => {
    const s = createScheduler();
    const a = rate(s, newCard('가방', now), Rating.Good, now, 1200);
    await saveAnswer(a.card, a.record);

    const json = JSON.stringify(createBackup((await getAllCards()).values(), await getAllReviews(), settings));
    const parsed = parseBackup(json);
    expect(parsed.cards[0].id).toBe('가방');
    expect(parsed.cards[0].due).toBeInstanceOf(Date);
    expect(parsed.reviews[0].review).toBeInstanceOf(Date);
    expect(parsed.reviews[0]).not.toHaveProperty('id');
    expect(parsed.settings?.dailyGoal).toBe(20);

    await clearProgress();
    await replaceProgress(parsed.cards, parsed.reviews);
    expect((await getAllCards()).get('가방')?.due.getTime()).toBe(a.card.due.getTime());
    expect(await getAllReviews()).toHaveLength(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"other","cards":[],"reviews":[]}')).toThrow(/not a Vocab Korean backup/);
    expect(() => parseBackup('{"app":"vocab-korean","version":99,"cards":[],"reviews":[]}')).toThrow(/newer version/);
    expect(() =>
      parseBackup('{"app":"vocab-korean","version":1,"cards":[{"id":"가","due":"soon"}],"reviews":[]}')
    ).toThrow(/Invalid date/);
  });

  it('names files by date', () => {
    expect(backupFileName(now)).toBe('vocab-korean-backup-2026-11-10.json');
  });
});
