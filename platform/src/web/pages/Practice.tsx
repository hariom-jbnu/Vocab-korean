import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { enabledModes } from '../../core/rules';
import { getScriptAdapter } from '../../core/script';
import { answer, currentStep, markMet, MAX_MISSES, nextStep, pickSessionCards, startSession, summarize, type SessionState } from '../../core/session';
import type { Outcome } from '../../core/quiz';
import type { Grade, SrsState } from '../../core/srs';
import { SKILL_MODES, type PracticeDeck, type SkillMode } from '../../core/types';
import { api } from '../api';
import { BrandBar, brandStyle, ErrorNote, Spinner } from '../components/ui';
import { MeetCard } from '../practice/shared';
import { ListeningRound, ReadingRound, VocabRound, WritingRound, type RoundProps } from '../practice/rounds';
import { MODE_INFO, useDeck } from './Deck';

const ROUNDS: Record<SkillMode, (p: RoundProps) => React.ReactNode> = {
  vocab: VocabRound,
  reading: ReadingRound,
  listening: ListeningRound,
  writing: WritingRound,
};

/** Wrong options each card showed lately stay out of its next few questions. */
const AVOID_FOR = 3;

export function PracticePage() {
  const { code, mode } = useParams();
  const { data, error } = useDeck(code);
  const [run, setRun] = useState(0);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Spinner />;
  const skill = mode as SkillMode;
  if (!SKILL_MODES.includes(skill) || !enabledModes(data.rules).includes(skill)) return <Navigate to={`/p/${data.deck.code}`} replace />;
  return <Runner key={`${skill}-${run}`} data={data} mode={skill} onRestart={() => setRun((r) => r + 1)} />;
}

function Runner({ data, mode, onRestart }: { data: PracticeDeck; mode: SkillMode; onRestart: () => void }) {
  const { deck, rules, branding, creator, cards } = data;
  const adapter = useMemo(() => getScriptAdapter(deck.scriptMeta), [deck.scriptMeta]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [studied, setStudied] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const recent = useRef(new Map<string, string[][]>());

  useEffect(() => {
    api
      .progress(deck.id, mode)
      .catch(() => ({ progress: {} as Record<string, SrsState> }))
      .then(({ progress }) => {
        const map = new Map(Object.entries(progress));
        setStudied(new Set(map.keys()));
        const ids = pickSessionCards(cards, map, rules.wordsPerSession, new Date());
        setSession(startSession(ids, map, rules, mode));
      });
  }, []);

  if (!session) return <Spinner />;
  const step = currentStep(session);
  const items = Object.values(session.items);
  const finished = items.filter((i) => i.correct >= i.needed || i.misses >= MAX_MISSES).length;
  const pct = session.phase === 'practice' ? Math.round((finished / Math.max(1, items.length)) * 100) : 100;

  function onDone(outcome: Outcome, grade: Grade, ms: number) {
    if (!session || step.kind !== 'question') return;
    const cardId = step.cardId;
    const r = answer(session, outcome, rules);
    setSession(r.state);
    if (r.firstAnswer) {
      setStudied((s) => new Set(s).add(cardId));
      api.answer({ deckId: deck.id, cardId, skill: mode, grade, outcome, ms }).then(
        () => setSaveError(null),
        (e: Error) => setSaveError(`Progress not saved: ${e.message}`)
      );
    }
  }

  const card = step.kind !== 'done' ? byId.get(step.cardId) : undefined;
  const Round = ROUNDS[mode];

  return (
    <div className="mx-auto max-w-2xl space-y-4" style={brandStyle(branding)}>
      <BrandBar branding={branding} fallbackTitle={creator.displayName} />
      <div className="flex items-center gap-3 text-sm">
        <Link to={`/p/${deck.code}`} className="text-slate-500 hover:text-slate-800">
          ✕ Quit
        </Link>
        <span className="font-semibold">
          {MODE_INFO[mode].icon} {MODE_INFO[mode].title}
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="tabular-nums text-slate-500">
          {finished}/{items.length}
        </span>
      </div>
      {session.phase === 'drill' && step.kind !== 'done' && (
        <div className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-900">Quick drill: one more try at the words you missed ({session.queue.length} left).</div>
      )}
      <ErrorNote error={saveError} />

      <div className="card min-h-80">
        {step.kind === 'done' ? (
          <Summary data={data} mode={mode} session={session} onRestart={onRestart} />
        ) : step.kind === 'meet' && card ? (
          <MeetCard key={`meet-${card.id}`} card={card} deck={deck} onDone={() => setSession(markMet(session))} />
        ) : card ? (
          <Round
            key={`${card.id}-${session.answers}`}
            card={card}
            data={data}
            adapter={adapter}
            firstTry={step.kind === 'question' && step.firstTry}
            isNew={session.items[card.id].isNew}
            studied={studied}
            avoid={new Set((recent.current.get(card.id) ?? []).flat())}
            onOptionsShown={(ids) => recent.current.set(card.id, [...(recent.current.get(card.id) ?? []), ids].slice(-AVOID_FOR))}
            onDone={onDone}
          />
        ) : null}
      </div>
    </div>
  );
}

function Summary({ data, mode, session, onRestart }: { data: PracticeDeck; mode: SkillMode; session: SessionState; onRestart: () => void }) {
  const { rules, deck, cards } = data;
  const navigate = useNavigate();
  const s = summarize(session);
  const next = nextStep(mode, rules, s);
  const minutes = Math.max(1, Math.round(s.durationMs / 60000));

  if (s.words === 0)
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg">This deck has no words yet.</p>
        <Link to={`/p/${deck.code}`} className="btn-ghost">
          Back to deck
        </Link>
      </div>
    );

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Session done 🎉</h2>
      {rules.endOfSession.summary && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-2xl font-bold">{s.words}</div>
              <div className="text-xs text-slate-500">words</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-2xl font-bold">{s.accuracy}%</div>
              <div className="text-xs text-slate-500">right first try</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-2xl font-bold">{minutes}</div>
              <div className="text-xs text-slate-500">{minutes === 1 ? 'minute' : 'minutes'}</div>
            </div>
          </div>
          {s.missed.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Words to watch</h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {s.missed.map((id) => {
                  const c = cards.find((x) => x.id === id);
                  return c ? (
                    <li key={id} className="flex gap-3 px-3 py-2">
                      <b lang={deck.targetLang}>{c.term}</b>
                      <span className="text-slate-600">{c.meaning}</span>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}
        </>
      )}
      {rules.endOfSession.nextStep && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
          <div className="text-sm font-semibold text-brand">Next step</div>
          <p className="mt-1">{next.reason}</p>
          <button className="btn-primary mt-3" onClick={() => (next.mode === mode ? onRestart() : navigate(`/p/${deck.code}/${next.mode}`))}>
            {next.mode === mode ? 'Practice again' : `Go to ${MODE_INFO[next.mode].title}`}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={onRestart}>
          Practice again
        </button>
        <Link to={`/p/${deck.code}`} className="btn-ghost">
          Back to deck
        </Link>
      </div>
    </div>
  );
}
