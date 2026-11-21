import React, { useEffect, useRef, useState } from 'react';
import type { VisibilitySettings, VocabItem } from '../types';
import { buildQuestion, gradeChoice, meaningLines, type Outcome, type Phase } from '../lib/quiz';
import type { AnswerMeta } from '../lib/answerPolicy';
import { recentDistractors, rememberDistractors } from '../lib/quizHistory';
import { cardText, copyText } from '../lib/clipboard';
import { contrastText } from '../lib/color';
import type { Grade } from '../lib/srs';
import Examples from './Examples';
import { useShortcuts } from '../hooks/useShortcuts';

interface ChoiceQuizProps {
  /** choice: read the Korean; listen: hear it (or read its sound); reverse: read the meaning, pick the Korean. */
  mode: 'choice' | 'listen' | 'reverse';
  phase: Phase;
  word: VocabItem;
  pool: readonly VocabItem[];
  /** Words already studied, preferred as wrong options. */
  studied: ReadonlySet<string>;
  /** Allow questions where the answer is left out ("Not in the list" is right). */
  allowMissing: boolean;
  /** False when the browser has no Korean voice: the listening round shows the sound in letters instead. */
  canListen: boolean;
  visibility: VisibilitySettings;
  cardBg: string;
  badge: React.ReactNode;
  speak: (text: string) => void;
  onAnswer: (grade: Grade, durationMs: number, meta: AnswerMeta) => void;
  paused: boolean;
}

/** Home-row keys for the four choices (1 2 3 4 work too). */
const CHOICE_KEYS = ['A', 'S', 'D', 'F'];

type Stage = 'recall' | 'choose' | 'done';
type Pick = number | 'none' | null;

const Kbd: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <kbd className={`hidden md:inline ml-2 text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-white/15' : 'bg-black/10'}`}>{children}</kbd>
);

/**
 * A multiple-choice round, recall first: the choices stay hidden until the
 * learner says "I know it" (Space) or "I don't know" (X). A fifth option,
 * "Not in the list", is right when the answer was left out.
 */
const ChoiceQuiz: React.FC<ChoiceQuizProps> = ({
  mode,
  phase,
  word,
  pool,
  studied,
  allowMissing,
  canListen,
  visibility,
  cardBg,
  badge,
  speak,
  onAnswer,
  paused,
}) => {
  const reverse = mode === 'reverse';
  const listening = mode === 'listen';
  const byEar = listening && canListen;

  const [question] = useState(() =>
    buildQuestion(word, pool, {
      studied,
      avoid: recentDistractors(word.id),
      show: reverse ? 'korean' : 'meaning',
      allowMissing,
    })
  );
  const [stage, setStage] = useState<Stage>(reverse ? 'choose' : 'recall');
  const [picked, setPicked] = useState<Pick>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const startedAt = useRef(Date.now());
  const chooseFrom = useRef(Date.now());
  const recallMs = useRef<number | undefined>(undefined);
  const chooseMs = useRef(0);
  const sent = useRef(false);

  const correctIndex = question.options.findIndex((c) => c.id === word.id);

  // Remember the wrong options once, so they stay out of this word's next questions.
  const remembered = useRef(false);
  useEffect(() => {
    if (remembered.current) return;
    remembered.current = true;
    rememberDistractors(
      word.id,
      question.options.filter((o) => o.id !== word.id).map((o) => o.id)
    );
  }, [question, word.id]);

  // In the listening round the audio is the question, so play it right away.
  useEffect(() => {
    if (byEar) speak(word.ko);
  }, [byEar, speak, word.ko]);

  const knowIt = () => {
    if (stage !== 'recall') return;
    recallMs.current = Date.now() - startedAt.current;
    chooseFrom.current = Date.now();
    setStage('choose');
  };

  const finish = (result: Outcome, pick: Pick) => {
    if (stage === 'done') return;
    if (stage === 'choose') chooseMs.current = Date.now() - chooseFrom.current;
    else recallMs.current = Date.now() - startedAt.current;
    setPicked(pick);
    setOutcome(result);
    setStage('done');
    speak(word.ko);
  };

  const pick = (p: number | 'none') => {
    if (stage !== 'choose') return;
    const right = p === 'none' ? !question.answerShown : p === correctIndex;
    finish(right ? 'right' : 'wrong', p);
  };

  const next = () => {
    if (stage !== 'done' || !outcome || sent.current) return;
    sent.current = true;
    const grade = gradeChoice({ outcome, recallMs: reverse ? undefined : recallMs.current, chooseMs: chooseMs.current });
    onAnswer(grade, (recallMs.current ?? 0) + chooseMs.current, {
      phase,
      outcome,
      // Said "I know it" first, then picked wrong.
      falseConfidence: !reverse && outcome === 'wrong' && recallMs.current !== undefined,
    });
  };

  const done = stage === 'done';

  useShortcuts((s) => {
    if (paused) return false;
    switch (s.type) {
      case 'primary':
        if (stage === 'recall') knowIt();
        else if (done) next();
        else return false;
        return true;
      case 'dontKnow':
        if (done) return false;
        finish('dontKnow', null);
        return true;
      case 'answer':
        if (stage !== 'choose' || s.n > question.options.length) return false;
        pick(s.n - 1);
        return true;
      case 'notInList':
        if (stage !== 'choose') return false;
        pick('none');
        return true;
      case 'speak':
        // In the meaning-to-Korean round the sound would give the answer away.
        if (reverse && !done) return false;
        speak(word.ko);
        return true;
      case 'copy':
        copyText(cardText(word, done ? 'full' : reverse ? 'meaning' : 'korean'));
        return true;
      default:
        return false;
    }
  });

  const lines = meaningLines(word, visibility);
  const textColor = contrastText(cardBg);
  const verdict = outcome === 'right' ? 'Correct' : outcome === 'dontKnow' ? 'Marked Again' : 'Not quite';

  const prompt = reverse ? (
    <div className="flex flex-col items-center text-center space-y-2">
      {lines.en && <p className="text-3xl md:text-4xl font-bold leading-tight">{lines.en}</p>}
      {lines.hi && (
        <p lang="hi" className="text-2xl md:text-3xl opacity-80 font-devanagari">
          {lines.hi}
        </p>
      )}
    </div>
  ) : listening && !done ? (
    byEar ? (
      <button
        onClick={() => speak(word.ko)}
        aria-label="Play the word again"
        className="w-28 h-28 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-6xl transition-all active:scale-95"
      >
        <i className="bi bi-volume-up-fill"></i>
      </button>
    ) : (
      // No Korean voice: read the sound instead.
      <p className="text-6xl md:text-7xl font-black tracking-tight leading-none text-center">{word.rom}</p>
    )
  ) : (
    <h1 lang="ko" className="text-7xl md:text-8xl font-black tracking-tight leading-none text-center break-keep">
      {word.ko}
    </h1>
  );

  const hint =
    stage === 'recall'
      ? listening
        ? byEar
          ? 'Recall the meaning of what you heard'
          : 'Read the sound, recall the meaning'
        : 'Say the meaning in your head'
      : reverse
        ? 'Pick the Korean word'
        : 'Pick the meaning';

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className="relative w-full flex flex-col justify-center items-center shadow-2xl rounded-[3rem] h-[300px] md:h-[340px] px-8 select-none"
        style={{ backgroundColor: cardBg, color: textColor }}
      >
        {badge}
        {(!reverse || done) && (
          <button
            onClick={() => speak(word.ko)}
            title="Play audio (J)"
            aria-label="Play audio"
            aria-keyshortcuts="J R"
            className="absolute top-5 right-6 w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
          >
            <i className="bi bi-volume-up-fill"></i>
          </button>
        )}
        {prompt}
        {done ? (
          <div className="flex flex-col items-center text-center mt-6 space-y-1 animate-fadeIn">
            {reverse ? (
              <p lang="ko" className="text-5xl md:text-6xl font-black tracking-tight">
                {word.ko}
              </p>
            ) : (
              <>
                {listening && (
                  <p lang="ko" className="text-5xl font-black tracking-tight mb-2">
                    {word.ko}
                  </p>
                )}
                {lines.en && <p className="text-2xl md:text-3xl font-bold">{lines.en}</p>}
                {lines.hi && (
                  <p lang="hi" className="text-xl md:text-2xl opacity-80 font-devanagari">
                    {lines.hi}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">{hint}</p>
        )}
      </div>

      {stage === 'recall' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
          <button
            onClick={knowIt}
            className="py-4 rounded-2xl bg-gray-900 text-white font-black tracking-widest uppercase text-xs shadow-xl hover:bg-black active:scale-[0.99] transition-all"
          >
            I know it · show choices
            <Kbd dark>Space</Kbd>
          </button>
          <button
            onClick={() => finish('dontKnow', null)}
            className="py-4 rounded-2xl bg-white/90 text-gray-800 font-black tracking-widest uppercase text-xs border border-black/5 shadow-sm hover:bg-white active:scale-[0.99] transition-all"
          >
            I don't know
            <Kbd>X</Kbd>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
          {question.options.map((c, i) => {
            const l = meaningLines(c, visibility);
            let tone = 'bg-white/90 hover:bg-white text-gray-900 border-black/5';
            if (done && i === correctIndex) tone = 'bg-emerald-600 text-white border-emerald-700';
            else if (done && i === picked) tone = 'bg-rose-600 text-white border-rose-700';
            else if (done) tone = 'bg-white/50 text-gray-500 border-black/5';
            return (
              <button
                key={c.id}
                onClick={() => pick(i)}
                disabled={done}
                className={`flex items-center gap-3 text-left px-4 py-3 rounded-2xl border shadow-sm transition-all active:scale-[0.99] ${tone}`}
              >
                <kbd
                  title={`Key ${CHOICE_KEYS[i]} or ${i + 1}`}
                  className="shrink-0 w-6 h-6 rounded-lg bg-black/10 text-[11px] font-black flex items-center justify-center"
                >
                  {CHOICE_KEYS[i]}
                </kbd>
                <span className="min-w-0">
                  {reverse ? (
                    <span lang="ko" className="block text-xl font-black leading-tight">
                      {c.ko}
                    </span>
                  ) : (
                    <>
                      {l.en && <span className="block font-bold leading-tight truncate">{l.en}</span>}
                      {l.hi && (
                        <span lang="hi" className="block text-sm opacity-80 font-devanagari truncate">
                          {l.hi}
                        </span>
                      )}
                    </>
                  )}
                  {/* After answering, each option shows its other side, so look-alikes are learned too. */}
                  {done && (
                    <span lang={reverse ? undefined : 'ko'} className="block text-xs font-bold opacity-70 truncate mt-0.5">
                      {reverse ? c.en : c.ko}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => pick('none')}
            disabled={done}
            className={`sm:col-span-2 flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border shadow-sm transition-all active:scale-[0.99] font-bold ${
              done && !question.answerShown
                ? 'bg-emerald-600 text-white border-emerald-700'
                : done && picked === 'none'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : done
                    ? 'bg-white/50 text-gray-500 border-black/5'
                    : 'bg-white/70 hover:bg-white text-gray-800 border-dashed border-black/20'
            }`}
          >
            <kbd title="Key N or 5" className="shrink-0 w-6 h-6 rounded-lg bg-black/10 text-[11px] font-black flex items-center justify-center">
              N
            </kbd>
            Not in the list
          </button>
        </div>
      )}

      {done && !question.answerShown && (
        <p className="text-center text-sm font-bold opacity-80 animate-fadeIn">
          The answer was not in the list this time: {reverse ? word.ko : word.en}.
        </p>
      )}

      {done && <Examples word={word} speak={speak} className="animate-fadeIn" />}

      {done && (
        <button
          onClick={next}
          className={`w-full py-4 rounded-2xl text-white font-black tracking-widest uppercase shadow-xl transition-all animate-fadeIn ${outcome === 'right' ? 'bg-gray-900 hover:bg-black' : 'bg-rose-700 hover:bg-rose-800'}`}
        >
          {verdict} · Continue
          <Kbd dark>Space</Kbd>
        </button>
      )}
    </div>
  );
};

export default ChoiceQuiz;
