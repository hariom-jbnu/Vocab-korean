/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Leave unset to run without accounts or sync. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Safe to ship to the browser. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Set by the Supabase integration on Vercel; used when the VITE_ names are not set. */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  /** "true" shows "Continue with Google" (enable the provider in Supabase first). */
  readonly VITE_GOOGLE_SIGN_IN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
