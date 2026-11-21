import { useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { parseCardText, CARD_TEXT_COLUMNS } from '../../core/cardText';
import { defaultScriptMeta } from '../../core/script';
import { api, LANGUAGES } from '../api';
import { useSession } from '../session';
import { ErrorNote, Spinner } from '../components/ui';

const SAMPLE: Record<string, string> = {
  ko: `물 | पानी | mul | 물 좀 주세요. | थोड़ा पानी दीजिए। | water
친구 | दोस्त | chingu | 그는 제 친구예요. | वह मेरा दोस्त है। | friend
학교 | स्कूल | hakgyo | 아이가 학교에 가요. | बच्चा स्कूल जाता है। | school
가다 | जाना | gada | 저는 학교에 가요. | मैं स्कूल जाता हूँ। | to go
먹다 | खाना | meokda | 저는 김치를 먹어요. | मैं किमची खाता हूँ। | to eat`,
  fr: `bonjour | hello | bon-ZHOOR | Bonjour, ça va ? | Hello, how are you?
merci | thank you | mehr-SEE | Merci beaucoup ! | Thank you very much!
pain | bread | PAN | Je voudrais du pain. | I would like some bread.
gare | station | GAHR | Où est la gare ? | Where is the station?
chat | cat | SHAH | Le chat dort. | The cat is sleeping.`,
};

export function NewDeckPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetLang, setTargetLang] = useState('ko');
  const [sourceLang, setSourceLang] = useState('hi');
  const [altLang, setAltLang] = useState('en');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseCardText(text), [text]);
  const script = defaultScriptMeta(targetLang);

  if (loading) return <Spinner />;
  if (user?.kind !== 'member') return <Navigate to="/login?next=/studio/new" replace />;

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { deck } = await api.createDeck({ title, description, targetLang, sourceLang, altLang: altLang || undefined, cardText: text });
      navigate(`/studio/decks/${deck.id}?created=1`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const langSelect = (value: string, set: (v: string) => void, allowNone = false) => (
    <select className="input" value={value} onChange={(e) => set(e.target.value)}>
      {allowNone && <option value="">None</option>}
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name} ({code})
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={create} className="space-y-5">
      <h1 className="text-2xl font-bold">New deck</h1>
      <div className="card space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode 12: food words" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description (optional)</span>
          <input className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Words from today's video" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Language to learn</span>
            {langSelect(targetLang, setTargetLang)}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Meanings in</span>
            {langSelect(sourceLang, setSourceLang)}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Second meaning (optional)</span>
            {langSelect(altLang, setAltLang, true)}
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Script: {script.script}, reading aid called “{script.readingLabel}”. You can change this later in the deck settings.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Words</h2>
            <p className="text-sm text-slate-600">
              One word per line: <code className="rounded bg-slate-100 px-1 text-xs">{CARD_TEXT_COLUMNS.join(' | ')}</code>. Only the first two are needed. Pasting from a spreadsheet (tabs) works too.
            </p>
          </div>
          <button type="button" className="btn-ghost text-sm" onClick={() => setText(SAMPLE[targetLang] ?? SAMPLE.fr)}>
            Fill a sample
          </button>
        </div>
        <textarea className="input font-mono text-sm" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'물 | पानी | mul | 물 좀 주세요. | थोड़ा पानी दीजिए। | water'} lang={targetLang} />
        <p className="text-sm text-slate-600">
          {parsed.cards.length} words ready
          {parsed.errors.length > 0 && (
            <span className="text-red-700">
              {' '}
              · line {parsed.errors[0].line}: {parsed.errors[0].message}
            </span>
          )}
        </p>
      </div>
      <ErrorNote error={error} />
      <button className="btn-primary w-full text-lg" disabled={busy || !title.trim() || parsed.errors.length > 0}>
        Create deck and get a code
      </button>
    </form>
  );
}
