/**
 * The four practice rounds. Each shows one card, takes one answer, shows
 * feedback, and calls onDone(outcome, grade, ms) when the learner moves on.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildQuestion, gradeChoice, gradeSelf, gradeTyped, type Outcome, type Question } from '../../core/quiz';
import type { ScriptAdapter } from '../../core/script';
import type { Grade } from '../../core/srs';
import type { Card, PracticeDeck } from '../../core/types';
import { Feedback, SpeakButton, Term, shuffle, useKeys, useSpeaker } from './shared';
import { wait } from './speech';

export interface RoundProps {
  card: Card;
  data: PracticeDeck;
  adapter: ScriptAdapter;
  firstTry: boolean;
  isNew: boolean;
  studied: ReadonlySet<string>;
  /** Wrong options this card showed recently. */
  avoid: ReadonlySet<string>;
  onOptionsShown: (ids: string[]) => void;
  onDone: (outcome: Outcome, grade: Grade, ms: number) => void;
}

const OPTION_KEYS = ['1', '2', '3', '4'];
const ALT_KEYS = ['a', 's', 'd', 'f'];

/** Four options plus, when allowed, "Not in the list". */
function Options({ q, card, notInList, onPick }: { q: Question; card: Card; notInList: boolean; onPick: (outcome: Outcome, pickedId: string | null) => void }) {
  const pick = (i: number) => {
    const o = q.options[i];
    if (o) onPick(o.id === card.id ? 'right' : 'wrong', o.id);
  };
  const none = () => onPick(q.answerShown ? 'wrong' : 'right', null);
  useKeys((k) => {
    const i = OPTION_KEYS.indexOf(k) >= 0 ? OPTION_KEYS.indexOf(k) : ALT_KEYS.indexOf(k);
    if (i >= 0) pick(i);
    if (notInList && (k === '5' || k === 'n')) none();
  });
  return (
    <div className="grid gap-2">
      {q.options.map((o, i) => (
        <button key={o.id} onClick={() => pick(i)} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand hover:bg-slate-50">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">{i + 1}</span>
          <span>
            <span className="block">{o.meaning}</span>
            {o.meaningAlt && <span className="block text-sm text-slate-500">{o.meaningAlt}</span>}
          </span>
        </button>
      ))}
      {notInList && (
        <button onClick={none} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-slate-600 hover:border-brand">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold">5</span>
          Not in the list
        </button>
      )}
    </div>
  );
}

function useQuestion(props: RoundProps) {
  const { card, data, adapter, firstTry, isNew, studied, avoid, onOptionsShown } = props;
  // "Not in the list" never on a brand-new word's first test.
  const allowMissing = data.rules.notInList && !(isNew && firstTry);
  const q = useMemo(() => buildQuestion(card, data.cards, adapter, { allowMissing, studied, avoid, show: 'meaning' }), [card.id]);
  useEffect(() => {
    onOptionsShown(q.options.filter((o) => o.id !== card.id).map((o) => o.id));
  }, [q]);
  return q;
}

function PickedNote({ picked, data }: { picked: string | null | undefined; data: PracticeDeck }) {
  if (picked === undefined) return null;
  if (picked === null) return <p className="text-sm text-slate-600">You picked “Not in the list”.</p>;
  const c = data.cards.find((x) => x.id === picked);
  return c ? (
    <p className="text-sm text-slate-600">
      You picked “{c.meaning}”, which is <b lang={data.deck.targetLang}>{c.term}</b>.
    </p>
  ) : null;
}

/* ---------------- Words (vocab) ---------------- */

export function VocabRound(props: RoundProps) {
  const { card, data, onDone } = props;
  const { rules, deck } = data;
  const q = useQuestion(props);
  const { play } = useSpeaker(deck);
  const [phase, setPhase] = useState<'recall' | 'choose' | 'feedback'>(rules.answerStyle === 'recall-first' ? 'recall' : 'choose');
  const t0 = useRef(Date.now());
  const recallMs = useRef<number | undefined>(undefined);
  const chooseStart = useRef(Date.now());
  const [result, setResult] = useState<{ outcome: Outcome; grade: Grade; ms: number; picked?: string | null }>();

  useEffect(() => {
    void play(card.term, { audioMediaId: card.audioMediaId });
  }, [card.id]);

  const know = () => {
    recallMs.current = Date.now() - t0.current;
    chooseStart.current = Date.now();
    setPhase('choose');
  };
  const finish = (outcome: Outcome, picked?: string | null) => {
    const grade = gradeChoice({ outcome, recallMs: recallMs.current, chooseMs: Date.now() - chooseStart.current });
    setResult({ outcome, grade, ms: Date.now() - t0.current, picked });
    setPhase('feedback');
  };

  useKeys((k) => {
    if (phase !== 'recall') return;
    if (k === ' ' || k === 'Enter') know();
    if (k === 'x' || k === 'Backspace') finish('dontKnow');
    if (k === 'j' || k === 'r') void play(card.term, { audioMediaId: card.audioMediaId });
  });

  if (phase === 'feedback' && result)
    return <Feedback ok={result.outcome === 'right'} card={card} deck={deck} extra={<PickedNote picked={result.picked} data={data} />} onContinue={() => onDone(result.outcome, result.grade, result.ms)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Term card={card} deck={deck} />
        <SpeakButton small onClick={() => play(card.term, { audioMediaId: card.audioMediaId })} />
      </div>
      {phase === 'recall' ? (
        <>
          <p className="text-slate-600">What does it mean? Think of the answer first, then check yourself.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => finish('dontKnow')}>
              I don't know <span className="kbd">X</span>
            </button>
            <button className="btn-primary" onClick={know} autoFocus>
              I know it <span className="kbd">Space</span>
            </button>
          </div>
        </>
      ) : (
        <Options q={q} card={card} notInList={rules.notInList} onPick={finish} />
      )}
    </div>
  );
}

/* ---------------- Listening ---------------- */

const readPref = (key: string, fallback: number) => {
  try {
    const v = Number(localStorage.getItem(key));
    return localStorage.getItem(key) !== null && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const writePref = (key: string, v: number) => {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    // Private mode: keep the value for this page only.
  }
};

export function ListeningRound(props: RoundProps) {
  const { card, data, onDone } = props;
  const { rules, deck } = data;
  const q = useQuestion(props);
  const { play, hasTts, lang } = useSpeaker(deck);
  const [speed, setSpeed] = useState(() => readPref('vp:listen-speed', rules.listening.speed));
  const [gap, setGap] = useState(() => readPref('vp:listen-gap', rules.listening.gapSeconds));
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<{ outcome: Outcome; grade: Grade; ms: number; picked?: string | null }>();
  const t0 = useRef(Date.now());
  /** When the sound first finished: answer speed is counted from here. */
  const heardAt = useRef<number | undefined>(undefined);
  const run = useRef(0);
  const canHear = !!card.audioMediaId || hasTts;
  const example = rules.listening.sentences ? card.examples[0] : undefined;

  /** Word, a pause, then the example sentence. */
  async function sequence() {
    const id = ++run.current;
    setPlaying(true);
    await play(card.term, { audioMediaId: card.audioMediaId, rate: speed });
    if (example && run.current === id) {
      await wait(gap * 1000);
      if (run.current === id) await play(example.text, { rate: speed });
    }
    if (run.current === id) setPlaying(false);
    heardAt.current ??= Date.now();
  }

  useEffect(() => {
    if (canHear) void sequence();
    return () => {
      run.current++;
    };
  }, [card.id, canHear]);

  useKeys((k) => {
    if (!result && (k === 'j' || k === 'r')) void sequence();
  });

  if (result) return <Feedback ok={result.outcome === 'right'} card={card} deck={deck} extra={<PickedNote picked={result.picked} data={data} />} onContinue={() => onDone(result.outcome, result.grade, result.ms)} />;

  return (
    <div className="space-y-5">
      {canHear ? (
        <div className="flex flex-col items-center gap-3">
          <button onClick={() => void sequence()} className={`grid h-24 w-24 place-items-center rounded-full bg-brand text-4xl text-white shadow-md transition hover:scale-105 ${playing ? 'animate-pulse' : ''}`} aria-label="Play again">
            🔊
          </button>
          <span className="text-sm text-slate-500">
            {example ? 'Word, pause, then a sentence.' : 'Listen to the word.'} Press <b>J</b> to replay.
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="font-semibold">This device has no voice for this language ({lang}).</div>
          {rules.listening.textFallback ? (
            <div className="mt-2">
              Read the sound instead: <span className="text-2xl font-bold">{card.reading || card.term}</span>
            </div>
          ) : (
            <div className="mt-2">
              Here is the word: <span className="text-2xl font-bold">{card.term}</span>
            </div>
          )}
          <div className="mt-1 text-sm">Tip: add a voice in your system settings, or ask the teacher to upload audio.</div>
        </div>
      )}

      {canHear && (
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-3">
            <span className="w-16 text-slate-600">Speed</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
                writePref('vp:listen-speed', Number(e.target.value));
              }}
              className="flex-1 accent-[var(--color-brand)]"
            />
            <span className="w-10 text-right tabular-nums">{speed.toFixed(2)}×</span>
          </label>
          {example && (
            <label className="flex items-center gap-3">
              <span className="w-16 text-slate-600">Pause</span>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={gap}
                onChange={(e) => {
                  setGap(Number(e.target.value));
                  writePref('vp:listen-gap', Number(e.target.value));
                }}
                className="flex-1 accent-[var(--color-brand)]"
              />
              <span className="w-10 text-right tabular-nums">{gap}s</span>
            </label>
          )}
        </div>
      )}

      <Options
        q={q}
        card={card}
        notInList={rules.notInList}
        onPick={(outcome, picked) => {
          run.current++;
          setResult({ outcome, grade: gradeChoice({ outcome, chooseMs: Date.now() - (heardAt.current ?? t0.current) }), ms: Date.now() - t0.current, picked });
        }}
      />
    </div>
  );
}

/* ---------------- Reading ---------------- */

export function ReadingRound({ card, data, firstTry, onDone }: RoundProps) {
  const { rules, deck } = data;
  const { play } = useSpeaker(deck);
  const example = card.examples[0];
  // A word's first read is the word; repeats read its example sentence.
  const sentence = !firstTry && rules.reading.sentences && example ? example : undefined;
  const text = sentence ? sentence.text : card.term;
  const hint = sentence ? sentence.reading : card.reading;
  const [hintShown, setHintShown] = useState(rules.reading.hints === 'show');
  const [revealed, setRevealed] = useState(false);
  const t0 = useRef(Date.now());
  const label = deck.scriptMeta.readingLabel;

  const done = (knew: boolean) => {
    const outcome: Outcome = knew ? (hintShown && rules.reading.hints !== 'show' ? 'near' : 'right') : 'wrong';
    onDone(outcome, gradeSelf(outcome), Date.now() - t0.current);
  };
  useKeys((k) => {
    if (!revealed) {
      if (k === ' ' || k === 'Enter') setRevealed(true);
      if (k === 'h' && hint && rules.reading.hints === 'tap') setHintShown(true);
    } else {
      if (k === '1') done(true);
      if (k === '2') done(false);
    }
  });

  return (
    <div className="space-y-5">
      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{sentence ? 'Read the sentence' : 'Read the word'}</div>
      <div lang={deck.targetLang} dir={deck.scriptMeta.direction} className={`font-bold ${sentence ? 'text-2xl leading-relaxed sm:text-3xl' : 'text-4xl sm:text-5xl'}`}>
        {text}
      </div>
      {hint && rules.reading.hints !== 'off' && (
        <div className="min-h-8">
          {hintShown ? (
            <span className="rounded-lg bg-sky-50 px-3 py-1 text-sky-900">
              {label}: {hint}
            </span>
          ) : (
            <button className="text-sm text-sky-700 underline" onClick={() => setHintShown(true)}>
              Show {label.toLowerCase()} <span className="kbd">H</span>
            </button>
          )}
        </div>
      )}
      {!revealed ? (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)} autoFocus>
          Show meaning <span className="kbd">Space</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-lg">{sentence ? sentence.translation || card.meaning : card.meaning}</div>
            {!sentence && card.meaningAlt && <div className="text-slate-500">{card.meaningAlt}</div>}
            {sentence && (
              <div className="mt-1 text-sm text-slate-500">
                Word: <b lang={deck.targetLang}>{card.term}</b> = {card.meaning}
              </div>
            )}
            <div className="mt-2">
              <SpeakButton small onClick={() => play(text, { audioMediaId: sentence ? undefined : card.audioMediaId })} />
            </div>
          </div>
          <p className="text-center text-sm text-slate-600">Did you read and understand it?</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => done(false)}>
              Not yet <span className="kbd">2</span>
            </button>
            <button className="btn-primary" onClick={() => done(true)}>
              Yes, I got it <span className="kbd">1</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Writing ---------------- */

export function WritingRound({ card, data, adapter, firstTry, onDone }: RoundProps) {
  const { rules } = data;
  const level = rules.writing.level;
  const promptTask = rules.writing.prompts && !!card.writingPrompt && !firstTry;
  if (promptTask) return <PromptTask card={card} data={data} onDone={onDone} />;
  if (level === 'self-check') return <SelfCheckWriting card={card} data={data} onDone={onDone} />;
  return <TypedWriting card={card} data={data} adapter={adapter} strict={level === 'strict'} onDone={onDone} />;
}

function MeaningPrompt({ card, data }: { card: Card; data: PracticeDeck }) {
  const { play } = useSpeaker(data.deck);
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Write the word for</div>
      <div className="mt-1 text-2xl font-semibold">{card.meaning}</div>
      {card.meaningAlt && <div className="text-slate-500">{card.meaningAlt}</div>}
      <div className="mt-2">
        <SpeakButton small onClick={() => play(card.term, { audioMediaId: card.audioMediaId })} label="Hear it" />
      </div>
    </div>
  );
}

function SelfCheckWriting({ card, data, onDone }: Pick<RoundProps, 'card' | 'data' | 'onDone'>) {
  const [revealed, setRevealed] = useState(false);
  const t0 = useRef(Date.now());
  const done = (knew: boolean) => onDone(knew ? 'right' : 'wrong', gradeSelf(knew ? 'right' : 'wrong'), Date.now() - t0.current);
  useKeys((k) => {
    if (!revealed && (k === ' ' || k === 'Enter')) setRevealed(true);
    if (revealed && k === '1') done(true);
    if (revealed && k === '2') done(false);
  });
  return (
    <div className="space-y-5">
      <MeaningPrompt card={card} data={data} />
      <p className="text-slate-600">Write it on paper (or in the air), then check.</p>
      {!revealed ? (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)} autoFocus>
          Show the answer <span className="kbd">Space</span>
        </button>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <Term card={card} deck={data.deck} />
            {card.reading && <div className="text-slate-500">{card.reading}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => done(false)}>
              Not yet <span className="kbd">2</span>
            </button>
            <button className="btn-primary" onClick={() => done(true)}>
              I wrote it right <span className="kbd">1</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Letter tiles: the answer's pieces plus a few from other words, shuffled. */
function makeTiles(card: Card, all: readonly Card[], adapter: ScriptAdapter): string[] {
  const own = adapter.units(card.term);
  const ownSet = new Set(own);
  const others = shuffle(all.filter((c) => c.id !== card.id).flatMap((c) => adapter.units(c.term))).filter((u) => !ownSet.has(u) && u.trim());
  const decoys = [...new Set(others)].slice(0, Math.min(3, Math.max(2, Math.ceil(own.length / 2))));
  return shuffle([...own, ...decoys]);
}

function TypedWriting({ card, data, adapter, strict, onDone }: Pick<RoundProps, 'card' | 'data' | 'adapter' | 'onDone'> & { strict: boolean }) {
  const { deck } = data;
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ outcome: Outcome; grade: Grade; ms: number }>();
  const tiles = useMemo(() => (strict ? [] : makeTiles(card, data.cards, adapter)), [card.id]);
  const [used, setUsed] = useState<number[]>([]);
  const t0 = useRef(Date.now());
  const input = useRef<HTMLInputElement>(null);

  const check = (e?: FormEvent) => {
    e?.preventDefault();
    const ms = Date.now() - t0.current;
    if (!typed.trim()) return setResult({ outcome: 'dontKnow', grade: gradeTyped('dontKnow', ms), ms });
    const r = adapter.compare(card.term, typed, strict);
    const outcome: Outcome = r.correct ? 'right' : r.nearMiss ? 'near' : 'wrong';
    setResult({ outcome, grade: gradeTyped(outcome, ms), ms });
  };
  const giveUp = () => setResult({ outcome: 'dontKnow', grade: gradeTyped('dontKnow', Date.now() - t0.current), ms: Date.now() - t0.current });
  useKeys((k) => {
    if (!result && k === 'Escape') giveUp();
  });

  if (result)
    return (
      <Feedback
        ok={result.outcome === 'right' || result.outcome === 'near'}
        near={result.outcome === 'near'}
        card={card}
        deck={deck}
        extra={
          typed.trim() ? (
            <p className="text-sm text-slate-600">
              You wrote: <b lang={deck.targetLang}>{typed}</b>
            </p>
          ) : null
        }
        onContinue={() => onDone(result.outcome, result.grade, result.ms)}
      />
    );

  return (
    <form onSubmit={check} className="space-y-5">
      <MeaningPrompt card={card} data={data} />
      <input
        ref={input}
        className="input text-2xl"
        lang={deck.targetLang}
        dir={deck.scriptMeta.direction}
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          setUsed([]);
        }}
        placeholder={strict ? 'Type the exact word' : 'Type it, or tap the letters below'}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
      />
      {!strict && (
        <div className="flex flex-wrap gap-2">
          {tiles.map((t, i) => (
            <button
              key={i}
              type="button"
              disabled={used.includes(i)}
              onClick={() => {
                setTyped((s) => s + t);
                setUsed((u) => [...u, i]);
                input.current?.focus();
              }}
              className="min-w-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xl hover:border-brand disabled:opacity-30"
              lang={deck.targetLang}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50"
            onClick={() => {
              setTyped('');
              setUsed([]);
            }}
          >
            Clear
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500">{strict ? 'Strict: spelling, accents and letters must match exactly.' : 'Guided: a one-letter slip still counts, and accents are optional.'}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={giveUp}>
          I don't know <span className="kbd">Esc</span>
        </button>
        <button className="btn-primary">
          Check <span className="kbd">Enter</span>
        </button>
      </div>
    </form>
  );
}

/** A teacher's own writing task, checked by the learner against the example. */
function PromptTask({ card, data, onDone }: Pick<RoundProps, 'card' | 'data' | 'onDone'>) {
  const { deck } = data;
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const t0 = useRef(Date.now());
  const done = (ok: boolean) => onDone(ok ? 'right' : 'wrong', gradeSelf(ok ? 'right' : 'wrong'), Date.now() - t0.current);
  const ex = card.examples[0];
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold tracking-wide text-brand uppercase">Teacher's writing task</div>
      <div className="text-xl font-semibold">{card.writingPrompt}</div>
      <div className="text-slate-600">
        <b lang={deck.targetLang}>{card.term}</b> = {card.meaning}
      </div>
      <textarea className="input" rows={3} lang={deck.targetLang} dir={deck.scriptMeta.direction} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write here (any keyboard), or on paper" />
      {!revealed ? (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)}>
          Compare with an example
        </button>
      ) : (
        <>
          {ex && (
            <div className="rounded-xl bg-slate-50 p-3">
              <div lang={deck.targetLang}>{ex.text}</div>
              {ex.translation && <div className="text-sm text-slate-500">{ex.translation}</div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => done(false)}>
              Needs more practice
            </button>
            <button className="btn-primary" onClick={() => done(true)}>
              I'm happy with it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
