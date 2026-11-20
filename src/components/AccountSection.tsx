import React, { useEffect, useState } from 'react';
import { useCloud } from '../hooks/useCloud';
import { authErrorText, MIN_PASSWORD } from '../lib/authErrors';

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

/** A password box with a button to show what was typed. */
const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
}> = ({ id, value, onChange, autoComplete, minLength }) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-gray-400 hover:text-gray-700"
      >
        <i className={`bi ${shown ? 'bi-eye-slash' : 'bi-eye'}`}></i>
      </button>
    </div>
  );
};

/** Choose a new password: after a reset link, or to add or change one while signed in. */
const NewPasswordForm: React.FC<{
  busy: boolean;
  onSave: (password: string) => void;
  onCancel: () => void;
  title: string;
}> = ({ busy, onSave, onCancel, title }) => {
  const [password, setPassword] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(password);
      }}
      className="space-y-2 p-4 bg-indigo-50/60 rounded-2xl"
    >
      <label htmlFor="account-new-password" className={label}>
        {title}
      </label>
      <PasswordInput id="account-new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={MIN_PASSWORD} />
      <p className="text-[11px] text-gray-400">At least {MIN_PASSWORD} characters.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={secondary}>
          Not now
        </button>
        <button type="submit" disabled={busy || password.length < MIN_PASSWORD} className={primary}>
          Save password
        </button>
      </div>
    </form>
  );
};

type Mode = 'sign-in' | 'sign-up';

/** Sign in to sync progress across devices. Hidden when the build has no Supabase. */
const AccountSection: React.FC = () => {
  const cloud = useCloud();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
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
      setMessage({ text: authErrorText(e), error: true });
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
    const showPasswordForm = cloud.recovering || changingPassword;
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
        {showPasswordForm && (
          <NewPasswordForm
            busy={busy}
            title={cloud.recovering ? 'Choose a new password' : 'New password'}
            onCancel={() => {
              cloud.cancelRecovery();
              setChangingPassword(false);
            }}
            onSave={(pw) =>
              act(async () => {
                await cloud.setPassword(pw);
                setChangingPassword(false);
              }, 'Password saved. Use it with your email to sign in on any device.')
            }
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => act(cloud.syncNow)} disabled={busy || cloud.status === 'syncing'} className={secondary}>
            <i className="bi bi-arrow-repeat mr-1.5"></i>Sync now
          </button>
          <button onClick={signOut} disabled={busy} className={secondary}>
            <i className="bi bi-box-arrow-right mr-1.5"></i>Sign out
          </button>
        </div>
        {!showPasswordForm && (
          <button
            onClick={() => {
              setMessage(null);
              setChangingPassword(true);
            }}
            className="text-[11px] font-bold text-gray-500 underline"
          >
            Set or change password
          </button>
        )}
        {status}
      </section>
    );
  }

  // An email was sent with a code: after "Email me a sign-in code", or to confirm a new account.
  if (sentTo) {
    return (
      <section className="space-y-3">
        {heading}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => cloud.verifyCode(sentTo, code));
          }}
          className="space-y-2"
        >
          <p className="text-[11px] text-gray-500">
            We sent an email to <span className="font-bold break-all">{sentTo}</span>. Open its link, or enter the code from it here.
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
            Back
          </button>
        </form>
        {status}
      </section>
    );
  }

  const signingUp = mode === 'sign-up';
  const tab = (m: Mode, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setMessage(null);
      }}
      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {text}
    </button>
  );

  return (
    <section className="space-y-3">
      {heading}
      <p className="text-[11px] text-gray-400">
        Sign in to keep your progress safe and use it on all your devices. Your email is your ID. You can keep studying without an account;
        your progress so far moves into your account when you sign in.
      </p>

      <div role="tablist" aria-label="Account" className="flex gap-1 p-1 rounded-2xl bg-gray-100">
        {tab('sign-in', 'Sign in')}
        {tab('sign-up', 'Create account')}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const to = email.trim();
          if (signingUp) {
            act(async () => {
              const result = await cloud.signUp(to, password);
              if (result === 'confirm-email') setSentTo(to);
            });
          } else {
            act(() => cloud.signIn(to, password));
          }
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
        <label htmlFor="account-password" className={label}>
          Password
        </label>
        <PasswordInput
          id="account-password"
          value={password}
          onChange={setPassword}
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          minLength={signingUp ? MIN_PASSWORD : undefined}
        />
        {signingUp && <p className="text-[11px] text-gray-400">At least {MIN_PASSWORD} characters.</p>}
        <button
          type="submit"
          disabled={busy || !email.trim() || !password || (signingUp && password.length < MIN_PASSWORD)}
          className={primary}
        >
          <i className={`bi ${signingUp ? 'bi-person-plus' : 'bi-box-arrow-in-right'} mr-1.5`}></i>
          {signingUp ? 'Create account' : 'Sign in'}
        </button>
        {!signingUp && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const to = email.trim();
              if (!to) {
                setMessage({ text: 'Type your email above first, then tap "Forgot password" again.', error: true });
                return;
              }
              act(
                () => cloud.sendPasswordReset(to),
                `If ${to} has an account, we sent it a link to choose a new password. Open it in this browser.`
              );
            }}
            className="text-[11px] font-bold text-gray-500 underline"
          >
            Forgot password?
          </button>
        )}
      </form>

      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-300">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className={`grid gap-2 ${cloud.googleEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const to = email.trim();
            if (!to) {
              setMessage({ text: 'Type your email above first.', error: true });
              return;
            }
            act(async () => {
              await cloud.sendCode(to);
              setSentTo(to);
            });
          }}
          className={secondary}
        >
          <i className="bi bi-envelope mr-1.5"></i>Email me a code
        </button>
        {cloud.googleEnabled && (
          <button type="button" onClick={() => act(cloud.signInWithGoogle)} disabled={busy} className={secondary}>
            <i className="bi bi-google mr-1.5"></i>Google
          </button>
        )}
      </div>
      {status}
    </section>
  );
};

export default AccountSection;
