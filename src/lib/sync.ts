import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from '../types';
import {
  clearDeletedReviewIds,
  clearProgressFromRemote,
  getDeletedReviewIds,
  getPendingCards,
  getPendingReviews,
  markCardsSynced,
  markReviewsSynced,
  mergeRemote,
} from './db';
import { loadJson, saveJson } from './storage';
import {
  cardToRow,
  chunk,
  latestSyncedAt,
  reviewToRow,
  rowToCard,
  rowToReview,
  syncedSettings,
  type CardRow,
  type ReviewRow,
  type SettingsRow,
} from './syncData';

/**
 * Two-way sync between IndexedDB and Supabase.
 *
 * Pull: fetch rows changed since the last pull (with a short overlap, since a
 * slow write can land with an earlier time) and merge them: newest card wins,
 * answers are added once. Push: upload pending answers, undone answers,
 * pending cards and changed settings.
 */

const META_KEY = 'sync';
/** Re-read this much before the cursor to catch writes that committed late. */
const OVERLAP_MS = 2 * 60_000;
const PAGE = 1000;
const UPLOAD_CHUNK = 500;
const EPOCH = '1970-01-01T00:00:00.000Z';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export interface SyncMeta {
  /** Account whose progress is in this browser. */
  userId: string | null;
  cardsCursor: string | null;
  reviewsCursor: string | null;
  /** Last remote progress reset this browser has applied. */
  resetAt: string | null;
  /** When settings last changed here, or the time of remote settings applied here (ms). */
  settingsChangedAt: number;
  /** settingsChangedAt as of the last upload. */
  settingsPushedAt: number;
  lastSyncedAt: number | null;
}

const EMPTY_META: SyncMeta = {
  userId: null,
  cardsCursor: null,
  reviewsCursor: null,
  resetAt: null,
  settingsChangedAt: 0,
  settingsPushedAt: 0,
  lastSyncedAt: null,
};

export const loadMeta = (): SyncMeta => loadJson<SyncMeta>(META_KEY, EMPTY_META);
const saveMeta = (meta: SyncMeta) => saveJson(META_KEY, meta);

/** Record a settings change made on this device. */
export function markSettingsChanged(at = Date.now()): void {
  saveMeta({ ...loadMeta(), settingsChangedAt: at });
}

/** Forget the signed-in account's sync state, keeping only settings timing. */
export function forgetSyncAccount(): void {
  const { settingsChangedAt } = loadMeta();
  saveMeta({ ...EMPTY_META, settingsChangedAt });
}

export interface SyncHooks {
  getSettings(): Settings;
  applySettings(remote: Partial<Settings>): void;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

const time = (s: string | null | undefined) => (s ? new Date(s).getTime() : -1);
const before = (cursor: string | null) => (cursor ? new Date(time(cursor) - OVERLAP_MS).toISOString() : EPOCH);

async function pullAll<T extends { synced_at?: string }>(
  fetchPage: (since: string, after: string) => PromiseLike<{ data: T[] | null; error: unknown }>,
  since: string,
  firstKey: string,
  keyOf: (row: T) => string
): Promise<T[]> {
  const rows: T[] = [];
  let at = since;
  let after = firstKey;
  for (;;) {
    const { data, error } = await fetchPage(at, after);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
    const last = page[page.length - 1];
    at = last.synced_at!;
    after = keyOf(last);
  }
}

async function pull(client: SupabaseClient, meta: SyncMeta, hooks: SyncHooks): Promise<{ pulled: number; remoteSettings: SettingsRow | null }> {
  const { data: settingsRow, error } = await client
    .from('user_settings')
    .select('settings, updated_at, progress_reset_at')
    .maybeSingle<SettingsRow>();
  if (error) throw error;

  // Progress was reset on another device: drop the copy here and start over.
  // On the first sync for this account, keep it instead and merge it in.
  const firstLink = !meta.cardsCursor && !meta.reviewsCursor && !meta.resetAt;
  const resetAt = settingsRow?.progress_reset_at ?? null;
  if (resetAt && time(resetAt) > time(meta.resetAt)) {
    if (!firstLink) {
      await clearProgressFromRemote();
      meta.cardsCursor = null;
      meta.reviewsCursor = null;
    }
    meta.resetAt = resetAt;
  }

  const [cardRows, reviewRows] = await Promise.all([
    pullAll<CardRow>(
      (since, after) => client.rpc('pull_cards', { since, after_word: after, max_rows: PAGE }),
      before(meta.cardsCursor),
      '',
      (r) => r.word_id
    ),
    pullAll<ReviewRow>(
      (since, after) => client.rpc('pull_reviews', { since, after_id: after, max_rows: PAGE }),
      before(meta.reviewsCursor),
      ZERO_UUID,
      (r) => r.id
    ),
  ]);

  const pulled = await mergeRemote(cardRows.map(rowToCard), reviewRows.map(rowToReview));
  meta.cardsCursor = latestSyncedAt(cardRows, meta.cardsCursor);
  meta.reviewsCursor = latestSyncedAt(reviewRows, meta.reviewsCursor);

  // Settings: the newer copy wins. Empty remote settings never win.
  const remote = settingsRow && Object.keys(settingsRow.settings ?? {}).length > 0 ? settingsRow : null;
  if (remote && time(remote.updated_at) > meta.settingsChangedAt) {
    hooks.applySettings(remote.settings);
    meta.settingsChangedAt = meta.settingsPushedAt = time(remote.updated_at);
  }
  return { pulled, remoteSettings: remote };
}

async function push(client: SupabaseClient, userId: string, meta: SyncMeta, hooks: SyncHooks, remoteSettings?: SettingsRow | null): Promise<number> {
  let pushed = 0;

  const deleted = await getDeletedReviewIds();
  for (const ids of chunk(deleted, UPLOAD_CHUNK)) {
    const { error } = await client.from('review_logs').delete().eq('user_id', userId).in('id', ids);
    if (error) throw error;
    await clearDeletedReviewIds(ids);
    pushed += ids.length;
  }

  const reviews = await getPendingReviews();
  for (const part of chunk(reviews, UPLOAD_CHUNK)) {
    const { error } = await client
      .from('review_logs')
      .upsert(part.map((r) => reviewToRow(r, userId)), { onConflict: 'user_id,id', ignoreDuplicates: true });
    if (error) throw error;
    await markReviewsSynced(part.map((r) => r.uid!));
    pushed += part.length;
  }

  const cards = await getPendingCards();
  for (const part of chunk(cards, UPLOAD_CHUNK)) {
    const { error } = await client.rpc('push_cards', { rows: part.map(cardToRow) });
    if (error) throw error;
    await markCardsSynced(part);
    pushed += part.length;
  }

  // After a pull we know the remote copy; otherwise push only local changes.
  const settingsDue =
    remoteSettings === undefined
      ? meta.settingsChangedAt > meta.settingsPushedAt
      : remoteSettings === null || meta.settingsChangedAt > time(remoteSettings.updated_at);
  if (settingsDue) {
    const changedAt = meta.settingsChangedAt || Date.now();
    const { error } = await client.rpc('push_settings', {
      new_settings: syncedSettings(hooks.getSettings()),
      changed_at: new Date(changedAt).toISOString(),
    });
    if (error) throw error;
    meta.settingsChangedAt = meta.settingsPushedAt = changedAt;
    pushed++;
  }
  return pushed;
}

/**
 * Sync this browser with the signed-in account. With `pull: false` it only
 * uploads local changes, which is what runs after each answer.
 */
export async function syncProgress(
  client: SupabaseClient,
  userId: string,
  hooks: SyncHooks,
  { pull: doPull = true }: { pull?: boolean } = {}
): Promise<SyncResult> {
  let meta = loadMeta();
  if (meta.userId !== userId) {
    // Progress here was synced with a different account: it is safe in that
    // account, so clear it rather than mixing two learners together.
    if (meta.userId) await clearProgressFromRemote();
    meta = { ...EMPTY_META, settingsChangedAt: meta.settingsChangedAt, userId };
  }

  let pulled = 0;
  let remoteSettings: SettingsRow | null | undefined;
  if (doPull) {
    ({ pulled, remoteSettings } = await pull(client, meta, hooks));
    saveMeta(meta);
  }
  const pushed = await push(client, userId, meta, hooks, remoteSettings);
  meta.lastSyncedAt = Date.now();
  saveMeta(meta);
  return { pulled, pushed };
}

/**
 * Delete all progress in the account, here and on every device. Returns once
 * the server has done it; local progress is cleared by the caller.
 */
export async function resetRemoteProgress(client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await client.rpc('reset_progress');
  if (error) throw error;
  const meta = loadMeta();
  saveMeta({ ...meta, userId, cardsCursor: null, reviewsCursor: null, resetAt: data as string });
}
