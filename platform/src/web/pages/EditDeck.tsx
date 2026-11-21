import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { formatCardText, parseCardText } from '../../core/cardText';
import { DEFAULT_RULES, type DeckRules } from '../../core/rules';
import type { Branding, Card, Creator, Deck } from '../../core/types';
import { api, LANGUAGES, mediaUrl } from '../api';
import { useSession } from '../session';
import { BrandBar, brandStyle, Choice, ErrorNote, Spinner, StatusBadge, Toggle } from '../components/ui';
import { mergeBranding } from '../../core/branding';

type Tab = 'share' | 'rules' | 'cards' | 'branding' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'share', label: 'Share' },
  { id: 'rules', label: 'Rules' },
  { id: 'cards', label: 'Words' },
  { id: 'branding', label: 'Branding' },
  { id: 'settings', label: 'Settings' },
];

interface Loaded {
  deck: Deck;
  rules: DeckRules;
  creator: Creator;
  cards: Card[];
}

export function EditDeckPage() {
  const { id } = useParams();
  const { user, loading } = useSession();
  const [params] = useSearchParams();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('share');

  useEffect(() => {
    if (id && user?.kind === 'member') api.studioDeck(id).then(setData, (e: Error) => setError(e.message));
  }, [id, user]);

  if (loading) return <Spinner />;
  if (user?.kind !== 'member') return <Navigate to={`/login?next=/studio/decks/${id}`} replace />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner />;
  const { deck, creator } = data;
  const branding = mergeBranding(creator.branding, deck.branding);

  return (
    <div className="space-y-5" style={brandStyle(branding)}>
      <Link to="/studio" className="text-sm text-slate-500 hover:text-slate-800">
        ← Your studio
      </Link>
      {params.get('created') && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900">Your deck is ready. Share the code below with your students.</div>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{deck.title}</h1>
        <StatusBadge status={deck.moderationStatus} />
        <span className="ml-auto rounded-xl bg-slate-900 px-3 py-1.5 font-mono text-xl font-bold tracking-[0.3em] text-white">{deck.code}</span>
      </div>
      {deck.moderationStatus !== 'active' && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {deck.moderationStatus === 'hidden' ? 'This deck is hidden after reports. Learners cannot open it until an admin restores it.' : 'This deck got several reports and is under review. Learners can still use it.'}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 whitespace-nowrap ${tab === t.id ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'share' && <ShareTab deck={deck} creator={creator} />}
      {tab === 'rules' && <RulesTab deck={deck} initial={data.rules} onSaved={(rules) => setData({ ...data, rules })} />}
      {tab === 'cards' && <CardsTab deck={deck} cards={data.cards} onSaved={(cards) => setData({ ...data, cards })} />}
      {tab === 'branding' && <DeckBrandingTab deck={deck} creator={creator} onSaved={(d) => setData({ ...data, deck: d })} />}
      {tab === 'settings' && <SettingsTab deck={deck} onSaved={(d) => setData({ ...data, deck: d })} />}
    </div>
  );
}

function ShareTab({ deck, creator }: { deck: Deck; creator: Creator }) {
  const link = `${location.origin}/${deck.code}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="card space-y-4">
      <p className="text-slate-700">Students open the link, or type the code on the home page. They can start right away as guests.</p>
      <div className="flex gap-2">
        <input className="input font-mono" readOnly value={link} onFocus={(e) => e.target.select()} />
        <button
          className="btn-primary"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Link to={`/p/${deck.code}`} className="btn-ghost">
          Try it as a student
        </Link>
        <Link to={`/@${creator.slug}`} className="btn-ghost">
          Your creator page
        </Link>
      </div>
      <p className="text-sm text-slate-500">Say it in a video like: “Go to the site and type {deck.code.split('').join(' ')}.” Codes never use 0, O, 1, I or L, so they are easy to read aloud.</p>
    </div>
  );
}

const isChanged = (path: string, rules: DeckRules) => {
  const get = (o: unknown) => path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], o);
  return get(rules) !== get(DEFAULT_RULES);
};

function RulesTab({ deck, initial, onSaved }: { deck: Deck; initial: DeckRules; onSaved: (r: DeckRules) => void }) {
  const [rules, setRules] = useState<DeckRules>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: (r: DeckRules) => DeckRules) => {
    setRules((r) => patch(structuredClone(r)));
    setMsg(null);
  };
  const ch = (p: string) => isChanged(p, rules);

  async function save() {
    setError(null);
    try {
      await api.updateDeck(deck.id, { rules });
      const fresh = await api.studioDeck(deck.id);
      setRules(fresh.rules);
      onSaved(fresh.rules);
      setMsg('Saved. Learners get the new rules on their next session.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Defaults are set for beginners. Change only what you need; anything you leave alone follows the defaults.</p>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">Practice modes</h3>
        {(['vocab', 'reading', 'listening', 'writing'] as const).map((m) => (
          <Toggle
            key={m}
            label={{ vocab: 'Words (meanings)', reading: 'Reading', listening: 'Listening', writing: 'Writing' }[m]}
            checked={rules.modes[m]}
            changed={ch(`modes.${m}`)}
            onChange={(v) => set((r) => ((r.modes[m] = v), r))}
          />
        ))}
      </section>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">Session</h3>
        <NumberRule label="Words per session" min={3} max={50} value={rules.wordsPerSession} changed={ch('wordsPerSession')} onChange={(v) => set((r) => ((r.wordsPerSession = v), r))} />
        <NumberRule label="Right answers each word needs" hint="Target repetitions in one session." min={1} max={5} value={rules.targetReps} changed={ch('targetReps')} onChange={(v) => set((r) => ((r.targetReps = v), r))} />
        <Choice
          label="How questions start"
          hint="Recall first: learners think of the meaning before they see options. Harder, and better for memory."
          value={rules.answerStyle}
          changed={ch('answerStyle')}
          options={[
            { value: 'recall-first', label: 'Recall first (default)' },
            { value: 'options', label: 'Show options at once' },
          ]}
          onChange={(v) => set((r) => ((r.answerStyle = v), r))}
        />
        <Toggle label="“Not in the list” option" hint="Sometimes the right answer is missing, so guessing by elimination does not work." checked={rules.notInList} changed={ch('notInList')} onChange={(v) => set((r) => ((r.notInList = v), r))} />
        <Toggle label="Show new words before testing them" checked={rules.meetNewWords} changed={ch('meetNewWords')} onChange={(v) => set((r) => ((r.meetNewWords = v), r))} />
      </section>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">End of session</h3>
        <Toggle label="Drill missed words" hint="One more quick try at every missed word." checked={rules.endOfSession.missedDrill} changed={ch('endOfSession.missedDrill')} onChange={(v) => set((r) => ((r.endOfSession.missedDrill = v), r))} />
        <Toggle label="Show a summary" checked={rules.endOfSession.summary} changed={ch('endOfSession.summary')} onChange={(v) => set((r) => ((r.endOfSession.summary = v), r))} />
        <Toggle label="Suggest a next step" checked={rules.endOfSession.nextStep} changed={ch('endOfSession.nextStep')} onChange={(v) => set((r) => ((r.endOfSession.nextStep = v), r))} />
      </section>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">Reading</h3>
        <Choice
          label={`${deck.scriptMeta.readingLabel} hint`}
          value={rules.reading.hints}
          changed={ch('reading.hints')}
          options={[
            { value: 'show', label: 'Always show' },
            { value: 'tap', label: 'One tap away (default)' },
            { value: 'off', label: 'Hidden' },
          ]}
          onChange={(v) => set((r) => ((r.reading.hints = v), r))}
        />
        <Toggle label="Also read example sentences" checked={rules.reading.sentences} changed={ch('reading.sentences')} onChange={(v) => set((r) => ((r.reading.sentences = v), r))} />
      </section>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">Listening</h3>
        <NumberRule label="Starting speed" step={0.05} min={0.5} max={1.5} value={rules.listening.speed} changed={ch('listening.speed')} onChange={(v) => set((r) => ((r.listening.speed = v), r))} suffix="×" />
        <NumberRule label="Pause between word and sentence" step={0.5} min={0} max={5} value={rules.listening.gapSeconds} changed={ch('listening.gapSeconds')} onChange={(v) => set((r) => ((r.listening.gapSeconds = v), r))} suffix="s" />
        <Toggle label="Play an example sentence after the word" checked={rules.listening.sentences} changed={ch('listening.sentences')} onChange={(v) => set((r) => ((r.listening.sentences = v), r))} />
        <Toggle label="Show the reading aid when the device has no voice" checked={rules.listening.textFallback} changed={ch('listening.textFallback')} onChange={(v) => set((r) => ((r.listening.textFallback = v), r))} />
      </section>

      <section className="card divide-y divide-slate-100">
        <h3 className="pb-2 font-semibold">Writing</h3>
        <Choice
          label="How strict"
          hint="Guided lets learners tap letter tiles, so nobody needs a special keyboard."
          value={rules.writing.level}
          changed={ch('writing.level')}
          options={[
            { value: 'self-check', label: 'Self-check (paper)' },
            { value: 'guided', label: 'Guided (default)' },
            { value: 'strict', label: 'Strict typing' },
          ]}
          onChange={(v) => set((r) => ((r.writing.level = v), r))}
        />
        <Toggle label="Use my writing prompts" hint="Add a prompt to a word in the Words tab (7th column)." checked={rules.writing.prompts} changed={ch('writing.prompts')} onChange={(v) => set((r) => ((r.writing.prompts = v), r))} />
      </section>

      <ErrorNote error={error} />
      <div className="sticky bottom-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button className="btn-primary" onClick={save}>
          Save rules
        </button>
        <button className="btn-ghost" onClick={() => set(() => structuredClone(DEFAULT_RULES))}>
          Reset to defaults
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}

function NumberRule({ label, hint, value, min, max, step = 1, suffix = '', changed, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; suffix?: string; changed?: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-wrap items-center gap-3 py-2">
      <span className="flex-1">
        <span className="font-medium">{label}</span>
        {changed && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">changed</span>}
        {hint && <span className="block text-sm text-slate-500">{hint}</span>}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-40 accent-[var(--color-brand)]" />
      <span className="w-12 text-right tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  );
}

function CardsTab({ deck, cards, onSaved }: { deck: Deck; cards: Card[]; onSaved: (c: Card[]) => void }) {
  const [text, setText] = useState(() => formatCardText(cards));
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseCardText(text);

  async function save() {
    setError(null);
    try {
      const r = await api.saveCards(deck.id, text);
      onSaved(r.cards);
      setText(formatCardText(r.cards));
      setMsg(`Saved ${r.cards.length} words. Learner progress is kept for words you did not change.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(card: Card, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const m = await api.upload(file);
      onSaved((await api.setCardAudio(deck.id, card.id, m.id)).cards);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-sm text-slate-600">
          One word per line: <code className="rounded bg-slate-100 px-1 text-xs">term | meaning | reading | example | example translation | meaning 2 | writing prompt</code>
        </p>
        <textarea className="input font-mono text-sm" rows={14} value={text} onChange={(e) => setText(e.target.value)} lang={deck.targetLang} />
        <p className="text-sm text-slate-600">
          {parsed.cards.length} words
          {parsed.errors.length > 0 && <span className="text-red-700"> · line {parsed.errors[0].line}: {parsed.errors[0].message}</span>}
        </p>
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={parsed.errors.length > 0}>
            Save words
          </button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
      </div>
      <details className="card">
        <summary className="cursor-pointer font-semibold">Recorded audio (optional)</summary>
        <p className="mt-2 text-sm text-slate-600">Upload your own voice for a word (mp3, m4a, ogg, webm or wav, up to 5 MB). Without it, the learner's device voice reads the word.</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {cards.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
              <b className="w-32 truncate" lang={deck.targetLang}>
                {c.term}
              </b>
              {c.audioMediaId ? (
                <>
                  <audio controls src={mediaUrl(c.audioMediaId)} className="h-8" />
                  <button className="text-sm text-red-700 underline" onClick={async () => onSaved((await api.setCardAudio(deck.id, c.id, null)).cards)}>
                    Remove
                  </button>
                </>
              ) : (
                <input type="file" accept="audio/*" className="text-sm" onChange={(e) => upload(c, e.target.files?.[0])} />
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Title, note, badge, color and logo. Empty fields fall back to the channel's branding. */
export function BrandingForm({ value, onChange }: { value: Branding; onChange: (b: Branding) => void }) {
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Branding, v: string) => onChange({ ...value, [k]: v || undefined });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Top bar title</span>
          <input className="input mt-1" maxLength={60} value={value.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Learn Korean with Priya" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Note under the title</span>
          <input className="input mt-1" maxLength={120} value={value.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="Words from episode 12" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Badge</span>
          <input className="input mt-1" maxLength={16} value={value.badge ?? ''} onChange={(e) => set('badge', e.target.value)} placeholder="TOPIK I" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Color</span>
          <div className="mt-1 flex gap-2">
            <input type="color" className="h-11 w-14 rounded-xl border border-slate-300" value={value.color ?? '#0f766e'} onChange={(e) => set('color', e.target.value)} />
            <button type="button" className="btn-ghost" onClick={() => set('color', '')}>
              Default
            </button>
          </div>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Logo</span>
        {value.logoMediaId && <img src={mediaUrl(value.logoMediaId)} alt="" className="h-10 w-10 rounded-lg object-cover" />}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setError(null);
            try {
              const m = await api.upload(f);
              onChange({ ...value, logoMediaId: m.id });
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
        {value.logoMediaId && (
          <button type="button" className="text-sm text-red-700 underline" onClick={() => onChange({ ...value, logoMediaId: undefined })}>
            Remove logo
          </button>
        )}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

function DeckBrandingTab({ deck, creator, onSaved }: { deck: Deck; creator: Creator; onSaved: (d: Deck) => void }) {
  const [branding, setBranding] = useState<Branding>(deck.branding);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const merged = mergeBranding(creator.branding, branding);
  async function save() {
    setError(null);
    try {
      onSaved((await api.updateDeck(deck.id, { branding })).deck);
      setMsg('Saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="card space-y-4" style={brandStyle(merged)}>
      <p className="text-sm text-slate-600">
        This deck's top bar. Leave a field empty to use your <Link to="/studio" className="underline">channel branding</Link>.
      </p>
      <BrandBar branding={merged} fallbackTitle={creator.displayName} />
      <BrandingForm value={branding} onChange={setBranding} />
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save}>
          Save branding
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}

function SettingsTab({ deck, onSaved }: { deck: Deck; onSaved: (d: Deck) => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    title: deck.title,
    description: deck.description,
    targetLang: deck.targetLang,
    sourceLang: deck.sourceLang,
    altLang: deck.altLang ?? '',
    visibility: deck.visibility,
    script: deck.scriptMeta.script,
    direction: deck.scriptMeta.direction,
    readingLabel: deck.scriptMeta.readingLabel,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      const r = await api.updateDeck(deck.id, {
        title: f.title,
        description: f.description,
        targetLang: f.targetLang,
        sourceLang: f.sourceLang,
        altLang: f.altLang,
        visibility: f.visibility,
        scriptMeta: { ...deck.scriptMeta, script: f.script, direction: f.direction, readingLabel: f.readingLabel },
      });
      onSaved(r.deck);
      setMsg('Saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const lang = (k: 'targetLang' | 'sourceLang' | 'altLang', none = false) => (
    <select className="input mt-1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      {none && <option value="">None</option>}
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name} ({code})
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input className="input mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <input className="input mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Language to learn</span>
            {lang('targetLang')}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Meanings in</span>
            {lang('sourceLang')}
          </label>
          <label className="block">
            <span className="text-sm font-medium">Second meaning</span>
            {lang('altLang', true)}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Script code</span>
            <input className="input mt-1" value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} placeholder="Hang, Latn, Deva…" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Direction</span>
            <select className="input mt-1" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as 'ltr' | 'rtl' })}>
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Reading aid name</span>
            <input className="input mt-1" value={f.readingLabel} onChange={(e) => setF({ ...f, readingLabel: e.target.value })} placeholder="Romanization" />
          </label>
        </div>
        <Choice
          label="Who can find it"
          value={f.visibility}
          options={[
            { value: 'public', label: 'Listed on my page' },
            { value: 'unlisted', label: 'Only with the code' },
          ]}
          onChange={(v) => setF({ ...f, visibility: v })}
        />
        <ErrorNote error={error} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save}>
            Save settings
          </button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        </div>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Delete this deck</div>
          <div className="text-sm text-slate-600">The code stops working and learner progress for it is removed.</div>
        </div>
        <DeleteButton
          onConfirm={async () => {
            await api.deleteDeck(deck.id);
            navigate('/studio');
          }}
        />
      </div>
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <div className="flex gap-2">
      <button className="btn-ghost" onClick={() => setSure(false)}>
        Keep it
      </button>
      <button className="btn-danger" onClick={() => void onConfirm()}>
        Yes, delete
      </button>
    </div>
  ) : (
    <button className="btn-danger" onClick={() => setSure(true)}>
      Delete deck
    </button>
  );
}
