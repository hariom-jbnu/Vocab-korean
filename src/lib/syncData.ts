import type { Settings } from '../types';
import type { ReviewRecord, WordCard } from './srs';

/**
 * Row shapes of the Supabase tables (see supabase/migrations) and the
 * conversions between them and the records kept in IndexedDB.
 */
export interface CardRow {
  word_id: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  updated_at: string;
  synced_at?: string;
}

export interface ReviewRow {
  user_id: string;
  id: string;
  word_id: string;
  rating: number;
  state: number;
  reviewed_at: string;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  duration_ms: number | null;
  synced_at?: string;
}

export interface SettingsRow {
  settings: Partial<Settings>;
  updated_at: string;
  progress_reset_at: string | null;
}

const iso = (d: Date | number) => new Date(d).toISOString();
const time = (s: string) => new Date(s).getTime();

export function cardToRow(card: WordCard): CardRow {
  return {
    word_id: card.id,
    due: iso(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: Math.round(card.elapsed_days ?? 0),
    scheduled_days: Math.round(card.scheduled_days),
    learning_steps: Math.round(card.learning_steps ?? 0),
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? iso(card.last_review) : null,
    updated_at: iso(card.updatedAt ?? 0),
  };
}

export function rowToCard(row: CardRow): WordCard {
  return {
    id: row.word_id,
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    ...(row.last_review ? { last_review: new Date(row.last_review) } : {}),
    updatedAt: time(row.updated_at),
  };
}

export function reviewToRow(record: ReviewRecord, userId: string): ReviewRow {
  if (!record.uid) throw new Error('Answer has no shared id');
  return {
    user_id: userId,
    id: record.uid,
    word_id: record.wordId,
    rating: record.rating,
    state: record.state,
    reviewed_at: iso(record.review),
    due: iso(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    scheduled_days: Math.round(record.scheduled_days),
    learning_steps: Math.round(record.learning_steps ?? 0),
    duration_ms: record.durationMs === undefined ? null : Math.max(0, Math.round(record.durationMs)),
  };
}

export function rowToReview(row: ReviewRow): ReviewRecord {
  return {
    uid: row.id,
    wordId: row.word_id,
    rating: row.rating as ReviewRecord['rating'],
    state: row.state,
    review: new Date(row.reviewed_at),
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
  };
}

/** Settings that depend on the device (installed voices) and are not synced. */
const DEVICE_ONLY: readonly (keyof Settings)[] = ['voiceName'];

export function syncedSettings(settings: Settings): Partial<Settings> {
  const out: Partial<Settings> = { ...settings };
  for (const key of DEVICE_ONLY) delete out[key];
  return out;
}

/** Apply settings from another device, keeping this device's own ones. */
export function applyRemoteSettings(local: Settings, remote: Partial<Settings>): Settings {
  const merged = { ...local };
  for (const [key, value] of Object.entries(remote) as [keyof Settings, unknown][]) {
    if (DEVICE_ONLY.includes(key) || !(key in local)) continue;
    // Skip values of the wrong type, e.g. from an older or newer version.
    if (typeof value !== typeof local[key]) continue;
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/** Latest timestamp among rows, used as the next pull cursor. */
export function latestSyncedAt(rows: readonly { synced_at?: string }[], fallback: string | null): string | null {
  let best = fallback;
  for (const r of rows) if (r.synced_at && (!best || time(r.synced_at) > time(best))) best = r.synced_at;
  return best;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
