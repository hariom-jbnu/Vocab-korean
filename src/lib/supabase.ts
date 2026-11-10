import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase is optional. Without its settings in the build the app works as
 * before: progress stays in this browser and there is no sign-in.
 */
const env = import.meta.env;
// The NEXT_PUBLIC_ names are what the Supabase integration on Vercel sets.
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = !!(url && key);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The Supabase client, loaded in its own chunk so it never delays the first
 * card. Null when the build has no Supabase settings.
 */
export function loadSupabase(): Promise<SupabaseClient> | null {
  if (!url || !key) return null;
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, {
      auth: {
        // PKCE puts ?code= in the query string, which leaves the #/route alone.
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  );
  return clientPromise;
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
