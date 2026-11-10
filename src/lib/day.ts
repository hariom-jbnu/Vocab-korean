/**
 * A study day starts at 4 a.m. local time, like Anki, so a late-night
 * session still counts toward the day the learner started it.
 */
export const DAY_ROLLOVER_HOUR = 4;

export function startOfStudyDay(now: Date, rolloverHour = DAY_ROLLOVER_HOUR): Date {
  const d = new Date(now);
  d.setHours(rolloverHour, 0, 0, 0);
  if (now.getTime() < d.getTime()) d.setDate(d.getDate() - 1);
  return d;
}

export function endOfStudyDay(now: Date, rolloverHour = DAY_ROLLOVER_HOUR): Date {
  const d = startOfStudyDay(now, rolloverHour);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Local calendar key of the study day, e.g. "2026-11-10". */
export function studyDayKey(now: Date, rolloverHour = DAY_ROLLOVER_HOUR): string {
  const d = startOfStudyDay(now, rolloverHour);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
