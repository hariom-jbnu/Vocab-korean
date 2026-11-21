import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Branding, Creator } from '../../core/types';
import { api, langName, type StudioDeck } from '../api';
import { useSession } from '../session';
import { BrandBar, brandStyle, ErrorNote, Spinner, StatusBadge } from '../components/ui';
import { BrandingForm } from './EditDeck';

export function StudioPage() {
  const { user, loading } = useSession();
  const [data, setData] = useState<{ creator: Creator; decks: StudioDeck[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.kind === 'member') api.myDecks().then(setData, (e: Error) => setError(e.message));
  }, [user]);

  if (loading) return <Spinner />;
  if (user?.kind !== 'member') return <Navigate to="/login?next=/studio" replace />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner />;
  const { creator, decks } = data;
  const subdomain = `${location.protocol}//${creator.slug}.${location.host}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your studio</h1>
          <p className="text-sm text-slate-600">
            Your page:{' '}
            <Link to={`/@${creator.slug}`} className="underline">
              /@{creator.slug}
            </Link>{' '}
            or{' '}
            <a href={subdomain} className="underline">
              {creator.slug}.{location.host}
            </a>
          </p>
        </div>
        <Link to="/studio/new" className="btn-primary">
          + New deck
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="card text-center text-slate-600">
          No decks yet. <Link to="/studio/new" className="text-brand underline">Make your first one</Link>: paste a word list and get a code.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {decks.map((d) => (
            <Link key={d.id} to={`/studio/decks/${d.id}`} className="card flex items-center gap-4 transition hover:border-brand">
              <span className="rounded-xl bg-slate-900 px-3 py-2 font-mono text-lg font-bold tracking-widest text-white">{d.code}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{d.title}</span>
                  <StatusBadge status={d.moderationStatus} />
                </span>
                <span className="text-sm text-slate-500">
                  {langName(d.targetLang)} · {d.cardCount} words · {d.visibility === 'public' ? 'listed' : 'code only'}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <ChannelSettings creator={creator} onSaved={(c) => setData({ ...data, creator: c })} />
    </div>
  );
}

function ChannelSettings({ creator, onSaved }: { creator: Creator; onSaved: (c: Creator) => void }) {
  const [displayName, setDisplayName] = useState(creator.displayName);
  const [branding, setBranding] = useState<Branding>(creator.branding);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      const r = await api.updateCreator({ displayName, branding });
      onSaved(r.creator);
      setMsg('Saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="card space-y-4" style={brandStyle(branding)}>
      <div>
        <h2 className="text-lg font-semibold">Your channel branding</h2>
        <p className="text-sm text-slate-600">Shown in the top bar of all your decks. A deck can override it.</p>
      </div>
      <BrandBar branding={branding} fallbackTitle={displayName} />
      <label className="block">
        <span className="text-sm font-medium">Your name</span>
        <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <BrandingForm value={branding} onChange={setBranding} />
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save}>
          Save branding
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </section>
  );
}
