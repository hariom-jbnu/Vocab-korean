import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, langName, type CreatorPageData } from '../api';
import { BrandBar, brandStyle, ErrorNote, Spinner, StatusBadge } from '../components/ui';

/** A creator's own page: /@slug or slug.localhost. */
export function CreatorPage({ slug }: { slug: string }) {
  const [data, setData] = useState<CreatorPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api.creatorPage(slug).then(setData, (e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner />;
  const { creator, decks } = data;

  return (
    <div className="space-y-5" style={brandStyle(creator.branding)}>
      <BrandBar branding={creator.branding} fallbackTitle={creator.displayName} />
      <h1 className="text-2xl font-bold">Decks by {creator.displayName}</h1>
      {decks.length === 0 && <p className="text-slate-600">No public decks yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {decks.map((d) => (
          <Link key={d.code} to={`/p/${d.code}`} className="card transition hover:border-brand">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-widest text-brand">{d.code}</span>
              <StatusBadge status={d.moderationStatus} />
            </div>
            <div className="mt-1 text-lg font-semibold">{d.title}</div>
            <p className="text-sm text-slate-600">{d.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {langName(d.targetLang)} · {d.cardCount} words
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
