import { describe, expect, it } from 'vitest';
import { endOfStudyDay, startOfStudyDay, studyDayKey } from './day';

describe('study day', () => {
  it('starts at 4 a.m. local time', () => {
    const afternoon = new Date(2026, 10, 10, 15, 0);
    expect(startOfStudyDay(afternoon)).toEqual(new Date(2026, 10, 10, 4, 0));
    expect(endOfStudyDay(afternoon)).toEqual(new Date(2026, 10, 11, 4, 0));
    expect(studyDayKey(afternoon)).toBe('2026-11-10');
  });

  it('counts a late-night session toward the previous day', () => {
    const lateNight = new Date(2026, 10, 11, 2, 30);
    expect(startOfStudyDay(lateNight)).toEqual(new Date(2026, 10, 10, 4, 0));
    expect(studyDayKey(lateNight)).toBe('2026-11-10');
  });
});
