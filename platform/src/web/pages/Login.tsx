import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useSession } from '../session';
import { ErrorNote } from '../components/ui';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh, google, user } = useSession();
  const navigate = useNavigate();
  const next = useSearchParams()[0].get('next') ?? '/studio';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await api.login({ username, password });
      else await api.register({ username, password, displayName: displayName || undefined });
      await refresh();
      navigate(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="card">
        <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-1.5 ${mode === m ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}>
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
        {user?.kind === 'guest' && <p className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">Your guest progress moves to your account when you sign in.</p>}
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          {mode === 'register' && <input className="input" placeholder="Name shown to students (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
          <input className="input" type="password" placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'register' && <p className="text-xs text-slate-500">3 to 24 letters, numbers or _. Password at least 8 characters.</p>}
          <ErrorNote error={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <a href={`/api/auth/google/start?next=${encodeURIComponent(next)}`} className="btn-ghost w-full">
          <span className="font-bold text-blue-600">G</span> Continue with Google
        </a>
        {google === 'mock' && <p className="mt-2 text-center text-xs text-slate-500">Local mode: opens a pretend Google page. No real account needed.</p>}
        <p className="mt-4 text-center text-xs text-slate-500">Sample accounts after seeding: demo / demo1234 (admin), ravi / ravi1234</p>
      </div>
    </div>
  );
}
