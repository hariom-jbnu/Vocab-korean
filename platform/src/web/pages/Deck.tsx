import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { enabledModes } from '../../core/rules';
import type { PracticeDeck, SkillMode } from '../../core/types';
import { api, langName } from '../api';
import { BrandBar, brandStyle, ErrorNote, ReportButton, Spinner } from '../components/ui';

export const MODE_INFO: Record<SkillMode, { title: string; icon: string; text: string }> = {
  vocab: { title: 'Words', icon: '🧠', text: 'Recall the meaning, then pick it.' },
  reading: { title: 'Reading', icon: '📖', text: 'Read words and sentences, with a hint if you need one.' },
  listening: { title: 'Listening', icon: '🎧', text: 'Hear the word and a sentence, then pick the meaning.' },
  writing: { title: 'Writing', icon: '✍️', text: 'Write the word: type it or tap the letters.' },
};

export function useDeck(code: string | undefined) {
  const [data, setData] = useState<PracticeDeck | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    setData(null);
    api.deckByCode(code).then(setData, (e: Error) => setError(e.message));
  }, [code]);
  return { data, error };
}

export function DeckPage() {
  const { code } = useParams();
  const { data, error } = useDeck(code);
  const [stats, setStats] = useState<Record<SkillMode, { studied: number; answers: number }> | null>(null);

  useEffect(() => {
    if (data) api.progress(data.deck.id, 'vocab').then((r) => setStats(r.stats), () => {});
  }, [data]);

  if (error)
    return (
      <div className="card text-center">
        <ErrorNote error={error} />
        <Link to="/" className="btn-ghost mt-4">
          Try another code
        </Link>
      </div>
    );
  if (!data) return <Spinner />;
  const { deck, rules, branding, creator, cards } = data;
  const modes = enabledModes(rules);
  const shareUrl = `${location.origin}/${deck.code}`;

  return (
    <div className="space-y-5" style={brandStyle(branding)}>
      <BrandBar branding={branding} fallbackTitle={creator.displayName} right={<Link to={`/@${creator.slug}`} className="text-sm text-white/90 underline">More decks</Link>} />
      {deck.moderationStatus === 'flagged' && <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">People reported this deck. It is under review, but you can still practice.</div>}

      <div className="card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{deck.title}</h1>
            <p className="mt-1 text-slate-600">{deck.description}</p>
            <p className="mt-2 text-sm text-slate-500">
              {langName(deck.targetLang)} · meanings in {langName(deck.sourceLang)}
              {deck.altLang ? ` and ${langName(deck.altLang)}` : ''} · {cards.length} words · by{' '}
              <Link to={`/@${creator.slug}`} className="underline">
                {creator.displayName}
              </Link>
            </p>
          </div>
          <div className="text-center">
            <div className="rounded-xl bg-slate-900 px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-white">{deck.code}</div>
            <button className="mt-1 text-xs text-slate-500 underline" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
              Copy link
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((m) => (
          <Link key={m} to={`/p/${deck.code}/${m}`} className="card flex items-center gap-4 transition hover:border-brand hover:shadow">
            <span className="text-3xl">{MODE_INFO[m].icon}</span>
            <span className="flex-1">
              <span className="block text-lg font-semibold">{MODE_INFO[m].title}</span>
              <span className="text-sm text-slate-600">{MODE_INFO[m].text}</span>
            </span>
            {stats && stats[m].studied > 0 && <span className="text-xs text-slate-500">{stats[m].studied} practiced</span>}
          </Link>
        ))}
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Words in this deck</summary>
        <ul className="mt-3 divide-y divide-slate-100">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="font-semibold" lang={deck.targetLang} dir={deck.scriptMeta.direction}>
                {c.term}
              </span>
              {c.reading && <span className="text-sm text-slate-400">{c.reading}</span>}
              <span className="flex-1 text-slate-600">{c.meaning}</span>
              <ReportButton targetType="card" targetId={c.id} label="" />
            </li>
          ))}
        </ul>
      </details>
      <div className="text-right">
        <ReportButton targetType="deck" targetId={deck.id} label="Report this deck" />
      </div>
    </div>
  );
}
