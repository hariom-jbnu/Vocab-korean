import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase is optional. Without its settings in the build the app works as
 * before: progress stays in this browser and there is no sign-in.
 */
const env = import.meta.env;
// The NEXT_PUBLIC_ names are what the Supabase integration on Vercel sets.
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const STAY_KEY = 'vocab:stay-signed-in';

/** False after the learner unticked "Stay signed in", e.g. on a university computer. */
export function staySignedIn(): boolean {
  try {
    return localStorage.getItem(STAY_KEY) !== 'no';
  } catch {
    return true;
  }
}

export function setStaySignedIn(stay: boolean): void {
  try {
    if (stay) localStorage.removeItem(STAY_KEY);
    else localStorage.setItem(STAY_KEY, 'no');
  } catch {
    // Storage blocked: the session follows the browser's default.
  }
}

/**
 * Where the sign-in is kept: localStorage normally, or sessionStorage when the
 * learner chose not to stay signed in, so closing the browser signs them out.
 */
const authStorage = {
  getItem(k: string): string | null {
    try {
      return (staySignedIn() ? localStorage : sessionStorage).getItem(k);
    } catch {
      return null;
    }
  },
  setItem(k: string, v: string): void {
    try {
      (staySignedIn() ? localStorage : sessionStorage).setItem(k, v);
    } catch {
      // Storage blocked: the session lasts until the page closes.
    }
  },
  removeItem(k: string): void {
    try {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    } catch {
      // Nothing stored.
    }
  },
};
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = !!(url && key);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The Supabase client, loaded in its own chunk so it never delays the first
 * card. Null when the build has no Supabase settings.
 */
export function loadSupabase(): Promise<SupabaseClient> | null {
  if (!url || !key) return null;
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const client = createClient(url, key, {
      auth: {
        // PKCE puts ?code= in the query string, which leaves the #/route alone.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
      },
    });
    // Listen now: a reset link is handled while the client starts, which can
    // be before the app subscribes, and only this event tells it apart.
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') notePasswordRecovery();
    });
    return client;
  });
  return clientPromise;
}

let recoveryPending = false;
const recoveryListeners = new Set<() => void>();

function notePasswordRecovery() {
  recoveryPending = true;
  for (const listener of recoveryListeners) listener();
}

/**
 * Call back when the learner arrives from a password reset link, including
 * if that happened before this was called.
 */
export function onPasswordRecovery(listener: () => void): () => void {
  recoveryListeners.add(listener);
  if (recoveryPending) listener();
  return () => {
    recoveryListeners.delete(listener);
  };
}

/** The new password is set (or the learner gave up): stop asking for it. */
export function endPasswordRecovery(): void {
  recoveryPending = false;
}

export const googleSignInEnabled = import.meta.env.VITE_GOOGLE_SIGN_IN === 'true';

/** Where sign-in links and Google send the learner back to: this page, without the route. */
export function authRedirectUrl(): string {
  return window.location.origin + window.location.pathname;
}

/**
 * An auth error sent back in the URL (for example an expired sign-in link).
 * It arrives as #error=...; read it and restore the route so the app shows.
 */
function takeAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
  const search = new URLSearchParams(window.location.search);
  const message = hash.get('error_description') ?? search.get('error_description');
  if (!message) return null;
  const clean = new URL(window.location.href);
  for (const k of ['error', 'error_code', 'error_description']) clean.searchParams.delete(k);
  clean.hash = '#/';
  window.history.replaceState(window.history.state, '', clean.toString());
  return message.replace(/\+/g, ' ');
}

/** Read once at startup, before the router looks at the URL. */
export const initialAuthError: string | null = cloudConfigured ? takeAuthErrorFromUrl() : null;
