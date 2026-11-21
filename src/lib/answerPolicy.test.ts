import { beforeEach, describe, expect, it } from 'vitest';
import { adjustCard, finalGrade, RECOGNITION_CAP_DAYS, RETRY_MINUTES } from './answerPolicy';
import { createScheduler, newCard, rate, Rating, State } from './srs';
import { AVOID_FOR, productionMisses, recentDistractors, rememberDistractors, setProductionMisses } from './quizHistory';

const DAY = 86_400_000;
const now = new Date('2026-11-21T10:00:00Z');
const review = (stability: number) => ({
  ...newCard('물', now),
  state: State.Review,
  stability,
  difficulty: 5,
  due: new Date(now.getTime() + 30 * DAY),
  scheduled_days: 30,
  last_review: new Date(now.getTime() - 10 * DAY),
  reps: 6,
});

describe('finalGrade', () => {
  it('keeps recognition grades as they are', () => {
    expect(finalGrade(Rating.Again, { phase: 'recognition', outcome: 'wrong' }, 0)).toEqual({ grade: Rating.Again, missStreak: 0 });
    expect(finalGrade(Rating.Good, undefined, 0)).toEqual({ grade: Rating.Good, missStreak: 0 });
  });

  it('turns a first production miss into Hard plus a retry, and a second into Again', () => {
    const first = finalGrade(Rating.Again, { phase: 'production', outcome: 'wrong' }, 0);
    expect(first).toEqual({ grade: Rating.Hard, retryMinutes: RETRY_MINUTES, missStreak: 1 });
    expect(finalGrade(Rating.Again, { phase: 'production', outcome: 'dontKnow' }, 1)).toEqual({ grade: Rating.Again, missStreak: 0 });
  });

  it('clears the miss streak when the word is produced', () => {
    expect(finalGrade(Rating.Easy, { phase: 'production', outcome: 'right' }, 1)).toEqual({ grade: Rating.Easy, missStreak: 0 });
    expect(finalGrade(Rating.Hard, { phase: 'production', outcome: 'near' }, 1)).toEqual({ grade: Rating.Hard, missStreak: 1 });
  });
});

describe('adjustCard', () => {
  it('caps a recognition round at 7 days, but not a production round', () => {
    const card = review(20);
    const capped = adjustCard(card, { phase: 'recognition', outcome: 'right' }, { grade: Rating.Good, missStreak: 0 }, now);
    expect(capped.due.getTime() - now.getTime()).toBe(RECOGNITION_CAP_DAYS * DAY);
    expect(capped.stability).toBe(20); // the memory strength is kept
    const produced = adjustCard(card, { phase: 'production', outcome: 'right' }, { grade: Rating.Good, missStreak: 0 }, now);
    expect(produced.due).toEqual(card.due);
  });

  it('brings a first production miss back in 10 minutes without losing strength', () => {
    const scheduler = createScheduler();
    const final = finalGrade(Rating.Again, { phase: 'production', outcome: 'wrong' }, 0);
    const rated = rate(scheduler, review(20), final.grade, now).card;
    const card = adjustCard(rated, { phase: 'production', outcome: 'wrong' }, final, now);
    expect(card.due.getTime() - now.getTime()).toBe(RETRY_MINUTES * 60_000);
    expect(card.state).toBe(State.Review);
    expect(card.stability).toBeGreaterThanOrEqual(20);
  });

  it('adds difficulty for false confidence', () => {
    const card = adjustCard(review(3), { phase: 'recognition', outcome: 'wrong', falseConfidence: true }, { grade: Rating.Again, missStreak: 0 }, now);
    expect(card.difficulty).toBe(6);
    const top = adjustCard({ ...review(3), difficulty: 9.6 }, { phase: 'recognition', outcome: 'wrong', falseConfidence: true }, { grade: Rating.Again, missStreak: 0 }, now);
    expect(top.difficulty).toBe(10);
  });

  it('leaves flip-card answers alone', () => {
    const card = review(20);
    expect(adjustCard(card, undefined, { grade: Rating.Good, missStreak: 0 }, now)).toBe(card);
  });
});

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('quiz history', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('remembers the wrong options of the last five questions per word', () => {
    for (let i = 0; i < AVOID_FOR + 2; i++) rememberDistractors('물', [`a${i}`, `b${i}`]);
    const recent = recentDistractors('물');
    expect(recent.has('a0')).toBe(false);
    expect(recent.has('a1')).toBe(false);
    expect(recent.has(`a${AVOID_FOR + 1}`)).toBe(true);
    expect(recent.size).toBe(AVOID_FOR * 2);
    expect(recentDistractors('불').size).toBe(0);
  });

  it('keeps production misses per word', () => {
    setProductionMisses('물', 1);
    expect(productionMisses('물')).toBe(1);
    setProductionMisses('물', 0);
    expect(productionMisses('물')).toBe(0);
  });
});
