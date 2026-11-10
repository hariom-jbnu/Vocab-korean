import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { VisibilitySettings, VocabItem } from '../types';
import { buildChoices, gradeChoice, meaningLines } from '../lib/quiz';
import { contrastText } from '../lib/color';
import type { Grade } from '../lib/srs';

interface ChoiceQuizProps {
  /** choice: read the word; listen: hear it with the word hidden. */
  mode: 'choice' | 'listen';
  word: VocabItem;
  pool: readonly VocabItem[];
  visibility: VisibilitySettings;
  cardBg: string;
  badge: React.ReactNode;
  speak: (text: string) => void;
  onAnswer: (grade: Grade, durationMs: number) => void;
  paused: boolean;
}

/** See (or hear) the Korean word and pick its meaning from four options. */
const ChoiceQuiz: React.FC<ChoiceQuizProps> = ({ mode, word, pool, visibility, cardBg, badge, speak, onAnswer, paused }) => {
  const choices = useMemo(() => buildChoices(word, pool), [word, pool]);
  const [picked, setPicked] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const answeredAfter = useRef(0);
  const sent = useRef(false);

  const listening = mode === 'listen';
  const correctIndex = choices.findIndex((c) => c.id === word.id);

  // In the listening round the audio is the question, so play it right away.
  useEffect(() => {
    if (listening) speak(word.ko);
  }, [listening, speak, word.ko]);
  const done = picked !== null;
  const correct = picked === correctIndex;

  const pick = (i: number) => {
    if (done) return;
    answeredAfter.current = Date.now() - startedAt.current;
    setPicked(i);
    speak(word.ko);
  };

  const next = () => {
    if (!done || sent.current) return;
    sent.current = true;
    onAnswer(gradeChoice(correct, answeredAfter.current), answeredAfter.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!done && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        pick(Number(e.key) - 1);
      } else if (done && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lines = meaningLines(word, visibility);
  const textColor = contrastText(cardBg);

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className="relative w-full flex flex-col justify-center items-center shadow-2xl rounded-[3rem] h-[300px] md:h-[340px] px-8 select-none"
        style={{ backgroundColor: cardBg, color: textColor }}
      >
        {badge}
        <button
          onClick={() => speak(word.ko)}
          title="Play audio (R)"
          aria-label="Play audio"
          className="absolute top-5 right-6 w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
        >
          <i className="bi bi-volume-up-fill"></i>
        </button>
        {listening && !done ? (
          <button
            onClick={() => speak(word.ko)}
            aria-label="Play the word again"
            className="w-28 h-28 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-6xl transition-all active:scale-95"
          >
            <i className="bi bi-volume-up-fill"></i>
          </button>
        ) : (
          <h1 lang="ko" className="text-7xl md:text-8xl font-black tracking-tight leading-none text-center break-keep">
            {word.ko}
          </h1>
        )}
        {done ? (
          <div className="flex flex-col items-center text-center mt-6 space-y-1 animate-fadeIn">
            {lines.en && <p className="text-2xl md:text-3xl font-bold">{lines.en}</p>}
            {lines.hi && (
              <p lang="hi" className="text-xl md:text-2xl opacity-80 font-devanagari">
                {lines.hi}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
            {listening ? 'What did you hear?' : 'Pick the meaning'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
        {choices.map((c, i) => {
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
              <kbd className="shrink-0 w-6 h-6 rounded-lg bg-black/10 text-[11px] font-black flex items-center justify-center">{i + 1}</kbd>
              <span className="min-w-0">
                {l.en && <span className="block font-bold leading-tight truncate">{l.en}</span>}
                {l.hi && (
                  <span lang="hi" className="block text-sm opacity-80 font-devanagari truncate">
                    {l.hi}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {done && (
        <button
          onClick={next}
          className={`w-full py-4 rounded-2xl text-white font-black tracking-widest uppercase shadow-xl transition-all animate-fadeIn ${correct ? 'bg-gray-900 hover:bg-black' : 'bg-rose-700 hover:bg-rose-800'}`}
        >
          {correct ? 'Correct' : 'Not quite'} · Continue
          <kbd className="hidden md:inline ml-3 text-[10px] bg-white/15 px-2 py-0.5 rounded">Space</kbd>
        </button>
      )}
    </div>
  );
};

export default ChoiceQuiz;
