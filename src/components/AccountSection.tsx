import React, { useEffect, useState } from 'react';
import { useCloud } from '../hooks/useCloud';

const label = 'block text-[10px] font-bold text-gray-500 uppercase mb-2';
const input =
  'w-full p-3 rounded-2xl border bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all';
const primary =
  'w-full py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50';
const secondary =
  'py-3 rounded-2xl bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 disabled:opacity-50';

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ms).toLocaleDateString();
}

function errorText(e: unknown): string {
  const text = e instanceof Error ? e.message : '';
  if (!text) return 'Something went wrong. Try again.';
  if (/failed to fetch|network|load failed/i.test(text)) return 'Could not reach the server. Check your connection and try again.';
  return text;
}

/** Sign in to sync progress across devices. Hidden when the build has no Supabase. */
const AccountSection: React.FC = () => {
  const cloud = useCloud();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(
    cloud.error ? { text: cloud.error, error: true } : null
  );

  useEffect(() => {
    if (cloud.error) setMessage({ text: cloud.error, error: true });
  }, [cloud.error]);

  if (!cloud.enabled) return null;

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage({ text: done });
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const signOut = () =>
    act(async () => {
      const left = await cloud.unsyncedCount();
      const ask =
        left > 0
          ? `${left} changes have not been uploaded yet (you may be offline). Sign out anyway and lose them?`
          : 'Sign out? Your progress is saved in your account and will be removed from this browser.';
      if (window.confirm(ask)) await cloud.signOut();
    });

  const heading = <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Account &amp; Sync</h3>;
  const status = message && (
    <p role="status" className={`text-[11px] font-bold ${message.error ? 'text-rose-600' : 'text-emerald-700'}`}>
      {message.text}
    </p>
  );

  if (cloud.status === 'loading') {
    return (
      <section className="space-y-3">
        {heading}
        <p className="text-[11px] text-gray-400">Checking your account…</p>
      </section>
    );
  }

  if (cloud.user) {
    const state =
      cloud.status === 'syncing'
        ? 'Syncing…'
        : cloud.status === 'offline'
          ? 'Offline. Changes will upload when you are back online.'
          : cloud.status === 'error'
            ? 'Last sync failed.'
            : cloud.lastSyncedAt
              ? `Synced ${ago(cloud.lastSyncedAt)}`
              : 'Not synced yet';
    return (
      <section className="space-y-3">
        {heading}
        <div className="p-4 bg-gray-50 rounded-2xl">
          <p className="text-sm font-black text-gray-700 break-all">{cloud.user.email ?? 'Signed in'}</p>
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1">
            <i className={`bi ${cloud.status === 'error' ? 'bi-cloud-slash text-rose-500' : cloud.status === 'offline' ? 'bi-cloud-slash' : 'bi-cloud-check text-emerald-600'}`}></i>
            {state}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => act(cloud.syncNow)} disabled={busy || cloud.status === 'syncing'} className={secondary}>
            <i className="bi bi-arrow-repeat mr-1.5"></i>Sync now
          </button>
          <button onClick={signOut} disabled={busy} className={secondary}>
            <i className="bi bi-box-arrow-right mr-1.5"></i>Sign out
          </button>
        </div>
        {status}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {heading}
      <p className="text-[11px] text-gray-400">
        Sign in to keep your progress safe and use it on all your devices. You can keep studying without an account; your progress so far
        moves into your account when you sign in.
      </p>

      {cloud.googleEnabled && (
        <button onClick={() => act(cloud.signInWithGoogle)} disabled={busy} className={`${secondary} w-full`}>
          <i className="bi bi-google mr-1.5"></i>Continue with Google
        </button>
      )}

      {!sentTo ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const to = email.trim();
            act(async () => {
              await cloud.sendCode(to);
              setSentTo(to);
            });
          }}
          className="space-y-2"
        >
          <label htmlFor="account-email" className={label}>
            Email
          </label>
          <input
            id="account-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
          <button type="submit" disabled={busy || !email.trim()} className={primary}>
            <i className="bi bi-envelope mr-1.5"></i>Email me a sign-in code
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => cloud.verifyCode(sentTo, code));
          }}
          className="space-y-2"
        >
          <p className="text-[11px] text-gray-500">
            We sent an email to <span className="font-bold break-all">{sentTo}</span>. Enter the code from it, or open its link on this device.
          </p>
          <label htmlFor="account-code" className={label}>
            Code
          </label>
          <input
            id="account-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${input} tracking-[0.4em] text-center`}
          />
          <button type="submit" disabled={busy || code.length < 6} className={primary}>
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setCode('');
              setMessage(null);
            }}
            className="text-[11px] font-bold text-gray-500 underline"
          >
            Use a different email
          </button>
        </form>
      )}
      {status}
    </section>
  );
};

export default AccountSection;
