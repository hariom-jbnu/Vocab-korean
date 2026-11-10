import { useEffect, useState } from 'react';
import { getReviewsSince, PROGRESS_EVENT } from '../lib/db';
import { studyDayKey } from '../lib/day';
import { answersPerDay, computeStreak, type StreakInfo } from '../lib/streak';

export interface DailyProgress {
  streak: StreakInfo;
  /** Answers given today. */
  today: number;
}

/** Streak and today's answer count, refreshed after every answer. */
export function useDailyProgress(): DailyProgress | null {
  const [progress, setProgress] = useState<DailyProgress | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 400);
        const perDay = answersPerDay((await getReviewsSince(since)).map((r) => r.review));
        const now = new Date();
        if (alive) setProgress({ streak: computeStreak(perDay, now), today: perDay.get(studyDayKey(now)) ?? 0 });
      } catch {
        // Storage unavailable: no streak to show.
      }
    };
    load();
    window.addEventListener(PROGRESS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(PROGRESS_EVENT, load);
    };
  }, []);

  return progress;
}
