import 'fake-indexeddb/auto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeType, type Settings } from '../types';
import { clearProgress, closeDb, getAllCards, getAllReviews, getPendingCards, saveAnswer, undoAnswer } from './db';
import { createScheduler, newCard, rate, Rating, State } from './srs';
import { loadMeta, markSettingsChanged, resetRemoteProgress, syncProgress } from './sync';
import type { CardRow, ReviewRow } from './syncData';

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
  clear() {
    this.data.clear();
  }
}

type Stamped<T> = T & { user_id: string; synced_at: string };
interface SettingsRecord {
  settings: Partial<Settings>;
  updated_at: string;
  progress_reset_at: string | null;
  synced_at: string;
}

const ms = (s: string) => new Date(s).getTime();
const after = (a: [string, string], b: [string, string]) => ms(a[0]) > ms(b[0]) || (ms(a[0]) === ms(b[0]) && a[1] > b[1]);

/** In-memory stand-in for the Supabase tables and functions in supabase/migrations. */
class FakeServer {
  cards = new Map<string, Stamped<CardRow>>();
  reviews = new Map<string, Stamped<ReviewRow>>();
  settings = new Map<string, SettingsRecord>();
  private clock = ms('2026-11-10T00:00:00Z');

  now(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }

  client(userId: string): SupabaseClient {
    const server = this;
    const ok = { error: null };
    const page = <T extends { synced_at: string }>(rows: T[], key: (r: T) => string, since: string, afterKey: string, max: number) =>
      rows
        .filter((r) => after([r.synced_at, key(r)], [since, afterKey]))
        .sort((a, b) => ms(a.synced_at) - ms(b.synced_at) || (key(a) < key(b) ? -1 : 1))
        .slice(0, max);

    const fake = {
      from(table: string) {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: table === 'vocab_user_settings' ? server.settings.get(userId) ?? null : null, error: null }),
          }),
          upsert: async (rows: ReviewRow[]) => {
            for (const r of rows) {
              const key = `${r.user_id}|${r.id}`;
              if (!server.reviews.has(key)) server.reviews.set(key, { ...r, synced_at: server.now() });
            }
            return ok;
          },
          delete: () => ({
            eq: (_col: string, uid: string) => ({
              in: async (_col2: string, ids: string[]) => {
                for (const id of ids) server.reviews.delete(`${uid}|${id}`);
                return ok;
              },
            }),
          }),
        };
      },
      async rpc(name: string, args: Record<string, unknown>) {
        const mine = <T extends { user_id: string }>(m: Map<string, T>) => [...m.values()].filter((r) => r.user_id === userId);
        switch (name) {
          case 'vocab_pull_cards':
            return { data: page(mine(server.cards), (r) => r.word_id, args.since as string, args.after_word as string, args.max_rows as number), error: null };
          case 'vocab_pull_reviews':
            return { data: page(mine(server.reviews), (r) => r.id, args.since as string, args.after_id as string, args.max_rows as number), error: null };
          case 'vocab_push_cards': {
            const at = server.now();
            for (const row of args.rows as CardRow[]) {
              const key = `${userId}|${row.word_id}`;
              const existing = server.cards.get(key);
              if (!existing || ms(existing.updated_at) < ms(row.updated_at)) server.cards.set(key, { ...row, user_id: userId, synced_at: at });
            }
            return { data: 0, error: null };
          }
          case 'vocab_push_settings': {
            const existing = server.settings.get(userId);
            const changedAt = args.changed_at as string;
            if (!existing || ms(existing.updated_at) < ms(changedAt)) {
              server.settings.set(userId, {
                settings: args.new_settings as Partial<Settings>,
                updated_at: changedAt,
                progress_reset_at: existing?.progress_reset_at ?? null,
                synced_at: server.now(),
              });
            }
            return { data: null, error: null };
          }
          case 'vocab_reset_progress': {
            const at = server.now();
            for (const [k, r] of server.cards) if (r.user_id === userId) server.cards.delete(k);
            for (const [k, r] of server.reviews) if (r.user_id === userId) server.reviews.delete(k);
            const existing = server.settings.get(userId);
            server.settings.set(userId, {
              settings: existing?.settings ?? {},
              updated_at: existing?.updated_at ?? new Date(0).toISOString(),
              progress_reset_at: at,
              synced_at: at,
            });
            return { data: at, error: null };
          }
        }
        throw new Error(`Unknown function ${name}`);
      },
    };
    return fake as unknown as SupabaseClient;
  }
}

const SETTINGS: Settings = {
  voiceName: '',
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

/** One browser's settings, as the app would hold them. */
function device(initial: Partial<Settings> = {}) {
  const state = { settings: { ...SETTINGS, ...initial } };
  return {
    state,
    hooks: {
      getSettings: () => state.settings,
      applySettings: (remote: Partial<Settings>) => {
        state.settings = { ...state.settings, ...remote, voiceName: state.settings.voiceName };
      },
    },
  };
}

/** Start over as a different browser: empty IndexedDB and localStorage. */
async function switchDevice() {
  await clearProgress();
  await closeDb();
  localStorage.clear();
}

const s = createScheduler();
const t0 = new Date('2026-11-10T10:00:00Z');

async function answer(word: string, grade: Rating.Again | Rating.Good | Rating.Easy, at = t0) {
  const card = (await getAllCards()).get(word) ?? newCard(word, at);
  const { card: next, record } = rate(s, card, grade, at);
  return saveAnswer(next, record);
}

let server: FakeServer;

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  server = new FakeServer();
});

afterEach(async () => {
  await clearProgress();
  await closeDb();
});

describe('progress sync', () => {
  it('uploads guest progress and settings on first sign-in', async () => {
    const a = device({ newPerDay: 15 });
    await answer('가방', Rating.Good);
    await answer('나무', Rating.Again);

    const result = await syncProgress(server.client('u1'), 'u1', a.hooks);
    expect(result.pulled).toBe(0);
    expect(server.cards.size).toBe(2);
    expect(server.reviews.size).toBe(2);
    expect(server.settings.get('u1')?.settings).toMatchObject({ newPerDay: 15 });
    expect(server.settings.get('u1')?.settings).not.toHaveProperty('voiceName');
    expect(await getPendingCards()).toEqual([]);
    expect(loadMeta().userId).toBe('u1');
  });

  it('brings progress and settings to a second device', async () => {
    const a = device({ seed: 42, dailyGoal: 50 });
    markSettingsChanged(Date.now() - 1000);
    await answer('가방', Rating.Good);
    await syncProgress(server.client('u1'), 'u1', a.hooks);

    await switchDevice();
    const b = device({ seed: 7, voiceName: 'Yuna' });
    const result = await syncProgress(server.client('u1'), 'u1', b.hooks);
    expect(result.pulled).toBe(2);
    expect((await getAllCards()).get('가방')?.state).not.toBe(State.New);
    expect(await getAllReviews()).toHaveLength(1);
    expect(b.state.settings).toMatchObject({ seed: 42, dailyGoal: 50, voiceName: 'Yuna' });
    // Pulled rows are not uploaded again.
    expect(await getPendingCards()).toEqual([]);
  });

  it('keeps the newest copy of a card across devices', async () => {
    const a = device();
    await answer('가방', Rating.Good);
    await syncProgress(server.client('u1'), 'u1', a.hooks);
    const firstReps = (await getAllCards()).get('가방')!.reps;

    await switchDevice();
    const b = device();
    await syncProgress(server.client('u1'), 'u1', b.hooks);
    await answer('가방', Rating.Good, new Date(t0.getTime() + 3600_000));
    await syncProgress(server.client('u1'), 'u1', b.hooks, { pull: false });
    expect(server.cards.get('u1|가방')?.reps).toBe(firstReps + 1);
    expect(server.reviews.size).toBe(2);

    // An older copy uploaded later does not overwrite it.
    const stale = { ...(await getAllCards()).get('가방')!, reps: 0, updatedAt: 1, pending: 1 as const };
    await server.client('u1').rpc('vocab_push_cards', { rows: [{ ...stale, word_id: '가방', updated_at: new Date(1).toISOString() }] });
    expect(server.cards.get('u1|가방')?.reps).toBe(firstReps + 1);
  });

  it('deletes an undone answer remotely', async () => {
    const a = device();
    const id = await answer('가방', Rating.Good);
    await syncProgress(server.client('u1'), 'u1', a.hooks);
    expect(server.reviews.size).toBe(1);

    await undoAnswer(undefined, '가방', id);
    await syncProgress(server.client('u1'), 'u1', a.hooks);
    expect(server.reviews.size).toBe(0);
    expect(server.cards.get('u1|가방')?.state).toBe(State.New);
    expect(await getAllReviews()).toEqual([]);
  });

  it('clears other devices after a reset, but not a device linking for the first time', async () => {
    const a = device();
    await answer('가방', Rating.Good);
    await syncProgress(server.client('u1'), 'u1', a.hooks);

    // Device B has synced before the reset.
    await switchDevice();
    const b = device();
    await syncProgress(server.client('u1'), 'u1', b.hooks);
    expect(await getAllReviews()).toHaveLength(1);
    const bMeta = loadMeta();

    // Device A resets everything.
    await resetRemoteProgress(server.client('u1'), 'u1');
    expect(server.reviews.size).toBe(0);

    // Back on B: its copy is dropped.
    localStorage.setItem('vocab:sync', JSON.stringify(bMeta));
    await syncProgress(server.client('u1'), 'u1', b.hooks);
    expect(await getAllReviews()).toEqual([]);
    expect(await getAllCards()).toEqual(new Map());

    // A new device with guest progress keeps it and uploads it.
    await switchDevice();
    const c = device();
    await answer('나무', Rating.Easy);
    await syncProgress(server.client('u1'), 'u1', c.hooks);
    expect(await getAllReviews()).toHaveLength(1);
    expect(server.reviews.size).toBe(1);
  });

  it('does not mix two accounts in one browser', async () => {
    const a = device();
    await answer('가방', Rating.Good);
    await syncProgress(server.client('u1'), 'u1', a.hooks);

    await syncProgress(server.client('u2'), 'u2', a.hooks);
    expect(await getAllReviews()).toEqual([]);
    expect([...server.reviews.values()].every((r) => r.user_id === 'u1')).toBe(true);
  });

  it('pulls long histories page by page', async () => {
    const at = server.now();
    for (let i = 0; i < 2100; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      server.reviews.set(`u1|${id}`, {
        user_id: 'u1',
        id,
        word_id: '가방',
        rating: 3,
        state: 2,
        reviewed_at: t0.toISOString(),
        due: t0.toISOString(),
        stability: 1,
        difficulty: 5,
        scheduled_days: 1,
        learning_steps: 0,
        duration_ms: null,
        // Many rows share one time, as after one big upload.
        synced_at: at,
      });
    }
    const a = device();
    const result = await syncProgress(server.client('u1'), 'u1', a.hooks);
    expect(result.pulled).toBe(2100);
    expect(await getAllReviews()).toHaveLength(2100);
  });
});
