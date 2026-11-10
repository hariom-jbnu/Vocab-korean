import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from '../types';
import { clearProgress, countPending, PROGRESS_EVENT, progressSource } from '../lib/db';
import { authRedirectUrl, cloudConfigured, googleSignInEnabled, initialAuthError, loadSupabase } from '../lib/supabase';
import { forgetSyncAccount, loadMeta, markSettingsChanged, resetRemoteProgress, syncProgress } from '../lib/sync';
import { applyRemoteSettings, syncedSettings } from '../lib/syncData';

export type CloudStatus = 'disabled' | 'loading' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

export interface CloudUser {
  id: string;
  email?: string;
}

export interface Cloud {
  /** False when the build has no Supabase settings: the app is local only. */
  enabled: boolean;
  googleEnabled: boolean;
  user: CloudUser | null;
  status: CloudStatus;
  lastSyncedAt: number | null;
  error: string | null;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  /** Answers not uploaded yet. Signing out with any of these loses them. */
  unsyncedCount(): Promise<number>;
  /** Upload what is left, sign out and remove this account's progress from this browser. */
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
  /** Delete the account's progress on every device. */
  resetEverywhere(): Promise<void>;
}

const CloudContext = createContext<Cloud | null>(null);

/** Upload this long after the last answer, so a burst of answers goes in one request. */
const PUSH_DELAY_MS = 4000;
/** Pull again on return to the app when the last sync is older than this. */
const STALE_MS = 60_000;

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

const errorText = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : 'Something went wrong.';

interface ProviderProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  children: React.ReactNode;
}

/** Accounts and progress sync through Supabase, when the build has it set up. */
export const CloudProvider: React.FC<ProviderProps> = ({ settings, setSettings, children }) => {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [status, setStatus] = useState<CloudStatus>(cloudConfigured ? 'loading' : 'disabled');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => loadMeta().lastSyncedAt);
  const [error, setError] = useState<string | null>(initialAuthError);

  const userRef = useRef<CloudUser | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsJson = useRef(JSON.stringify(syncedSettings(settings)));

  const running = useRef<Promise<void> | null>(null);
  const queued = useRef<{ pull: boolean } | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hooks = useMemo(
    () => ({
      getSettings: () => settingsRef.current,
      applySettings: (remote: Partial<Settings>) => {
        const merged = applyRemoteSettings(settingsRef.current, remote);
        settingsJson.current = JSON.stringify(syncedSettings(merged));
        settingsRef.current = merged;
        setSettings(merged);
      },
    }),
    [setSettings]
  );

  const run = useCallback(
    (pull: boolean): Promise<void> => {
      const current = userRef.current;
      if (!client || !current) return Promise.resolve();
      if (running.current) {
        queued.current = { pull: pull || !!queued.current?.pull };
        return running.current;
      }
      clearTimeout(pushTimer.current);
      if (pull) setStatus('syncing');
      const job = (async () => {
        try {
          await syncProgress(client, current.id, hooks, { pull });
          setStatus('idle');
          setError(null);
          setLastSyncedAt(Date.now());
        } catch (e) {
          setStatus(navigator.onLine ? 'error' : 'offline');
          setError(navigator.onLine ? errorText(e) : null);
        } finally {
          running.current = null;
          const next = queued.current;
          queued.current = null;
          if (next && userRef.current) void run(next.pull);
        }
      })();
      running.current = job;
      return job;
    },
    [client, hooks]
  );

  const schedulePush = useCallback(() => {
    if (!userRef.current) return;
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void run(false), PUSH_DELAY_MS);
  }, [run]);

  useEffect(() => {
    loadSupabase()
      ?.then(setClient)
      .catch(() => {
        // Offline on the very first visit: sign-in shows up on a later visit.
        setStatus('offline');
      });
  }, []);

  // Follow the sign-in state. A new sign-in starts a full sync.
  useEffect(() => {
    if (!client) return;
    const apply = (next: CloudUser | null) => {
      const changed = next?.id !== userRef.current?.id;
      userRef.current = next;
      setUser(next);
      if (!next) setStatus('signed-out');
      else if (changed) void run(true);
    };
    client.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      apply(u ? { id: u.id, email: u.email } : null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      // Supabase advises against awaiting its own calls inside this callback.
      setTimeout(() => apply(u ? { id: u.id, email: u.email } : null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [client, run]);

  // Upload shortly after answers here; pull when coming back or back online.
  useEffect(() => {
    if (!client) return;
    const onProgress = (e: Event) => {
      if (progressSource(e) === 'local') schedulePush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void run(false);
      else if (Date.now() - (loadMeta().lastSyncedAt ?? 0) > STALE_MS) void run(true);
    };
    const onOnline = () => void run(true);
    window.addEventListener(PROGRESS_EVENT, onProgress);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, onProgress);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      clearTimeout(pushTimer.current);
    };
  }, [client, run, schedulePush]);

  // Note settings changed here (not ones that came from another device).
  useEffect(() => {
    const json = JSON.stringify(syncedSettings(settings));
    if (json === settingsJson.current) return;
    settingsJson.current = json;
    markSettingsChanged();
    schedulePush();
  }, [settings, schedulePush]);

  const value = useMemo<Cloud>(
    () => ({
      enabled: cloudConfigured,
      googleEnabled: cloudConfigured && googleSignInEnabled,
      user,
      status,
      lastSyncedAt,
      error,
      async sendCode(email) {
        if (!client) throw new Error(UNREACHABLE);
        const { error: e } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
        });
        if (e) throw e;
      },
      async verifyCode(email, code) {
        if (!client) throw new Error(UNREACHABLE);
        const { error: e } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        if (e) throw e;
      },
      async signInWithGoogle() {
        if (!client) throw new Error(UNREACHABLE);
        const { error: e } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl() } });
        if (e) throw e;
      },
      async unsyncedCount() {
        await run(false);
        return countPending();
      },
      async signOut() {
        if (!client) return;
        await client.auth.signOut({ scope: 'local' });
        userRef.current = null;
        await clearProgress();
        forgetSyncAccount();
        window.location.reload();
      },
      async syncNow() {
        await run(true);
      },
      async resetEverywhere() {
        const current = userRef.current;
        if (!client || !current) return;
        await run(false);
        await resetRemoteProgress(client, current.id);
      },
    }),
    [client, user, status, lastSyncedAt, error, run]
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
};

export function useCloud(): Cloud {
  const cloud = useContext(CloudContext);
  if (!cloud) throw new Error('useCloud must be used inside CloudProvider');
  return cloud;
}
