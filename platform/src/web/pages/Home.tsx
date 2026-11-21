import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { codeProblem, normalizeCode } from '../../core/code';
import { api, langName, type CreatorPageData } from '../api';
import { ErrorNote } from '../components/ui';

export function HomePage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<CreatorPageData['decks']>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all(['demo', 'ravi'].map((s) => api.creatorPage(s).catch(() => null))).then((pages) => setSamples(pages.flatMap((p) => p?.decks ?? [])));
  }, []);

  async function go(e: FormEvent) {
    e.preventDefault();
    const problem = codeProblem(code);
    if (problem) return setError(problem);
    setError(null);
    try {
      await api.deckByCode(normalizeCode(code));
      navigate(`/p/${normalizeCode(code)}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-10">
      <section className="mx-auto max-w-xl pt-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Practice any word list with a 4-character code</h1>
        <p className="mt-3 text-slate-600">Got a code from your teacher or a video? Type it here. No sign-up needed.</p>
        <form onSubmit={go} className="mt-6 flex gap-2">
          <input
            className="input text-center font-mono text-2xl tracking-[0.4em] uppercase"
            maxLength={6}
            placeholder="A7K9"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Deck code"
            autoFocus
          />
          <button className="btn-primary px-6 text-lg">Go</button>
        </form>
        <div className="mt-3">
          <ErrorNote error={error} />
        </div>
      </section>

      {samples.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Sample decks</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {samples.map((d) => (
              <Link key={d.code} to={`/p/${d.code}`} className="card flex items-center gap-4 transition hover:border-brand">
                <span className="rounded-xl bg-slate-900 px-3 py-2 font-mono text-lg font-bold tracking-widest text-white">{d.code}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{d.title}</span>
                  <span className="text-sm text-slate-500">
                    {langName(d.targetLang)} for {langName(d.sourceLang)} speakers · {d.cardCount} words
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Creator pages: <Link className="underline" to="/@demo">/@demo</Link>, <Link className="underline" to="/@ravi">/@ravi</Link>, or as a subdomain:{' '}
            <a className="underline" href={`${location.protocol}//ravi.${location.host}`}>
              ravi.{location.host}
            </a>
          </p>
        </section>
      )}
      {samples.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          No sample decks yet. Run <code className="rounded bg-slate-100 px-1">npm run seed</code>, or <Link to="/studio/new" className="underline">make your own deck</Link>.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['For students', 'Enter a code and start. Your progress is saved in this browser as a guest; sign up later to keep it.'],
          ['For teachers', 'Paste a word list, get a code, share it. Turn rules on or off and add your logo and title.'],
          ['Any language', 'Korean, Hindi, Spanish, Japanese and more. Read, listen and write, with easy defaults.'],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
      <p className="text-center">
        <Link to="/studio/new" className="btn-primary">
          Create a deck
        </Link>{' '}
        <Link to="/docs" className="btn-ghost">
          Read the manual
        </Link>
      </p>
    </div>
  );
}
