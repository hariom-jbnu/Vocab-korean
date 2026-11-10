import React, { useEffect, useRef, useState } from 'react';
import type { VisibilitySettings, VocabItem } from '../types';
import { gradeTyped, meaningLines } from '../lib/quiz';
import { checkTyped, type TypedCheck } from '../lib/hangul';
import { contrastText } from '../lib/color';
import type { Grade } from '../lib/srs';

interface TypingQuizProps {
  word: VocabItem;
  visibility: VisibilitySettings;
  cardBg: string;
  badge: React.ReactNode;
  speak: (text: string) => void;
  onAnswer: (grade: Grade, durationMs: number) => void;
  onDisableTyping: () => void;
  paused: boolean;
}

const BLOCK_COLORS = {
  ok: 'text-emerald-600',
  wrong: 'text-rose-600 underline decoration-4 underline-offset-8',
  missing: 'text-rose-600 opacity-50',
};

/** See the meaning, type the Korean word. Shows which syllable was wrong. */
const TypingQuiz: React.FC<TypingQuizProps> = ({ word, visibility, cardBg, badge, speak, onAnswer, onDisableTyping, paused }) => {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<TypedCheck | null>(null);
  const startedAt = useRef(Date.now());
  const answeredAfter = useRef(0);
  const sent = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const check = (giveUp = false) => {
    if (result) return;
    answeredAfter.current = Date.now() - startedAt.current;
    setResult(giveUp ? checkTyped(word.ko, '') : checkTyped(word.ko, typed));
    speak(word.ko);
  };

  const next = () => {
    if (!result || sent.current) return;
    sent.current = true;
    onAnswer(gradeTyped(result, answeredAfter.current), answeredAfter.current);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || !result || e.target === inputRef.current) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lines = meaningLines(word, visibility);
  const textColor = contrastText(cardBg);
  const verdict = result?.correct ? 'Correct' : result?.nearMiss ? 'Almost' : 'Not quite';

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className="relative w-full flex flex-col justify-center items-center shadow-2xl rounded-[3rem] h-[300px] md:h-[340px] px-8"
        style={{ backgroundColor: cardBg, color: textColor }}
      >
        {badge}
        <div className="flex flex-col items-center text-center space-y-2">
          {lines.en && <p className="text-3xl md:text-4xl font-bold leading-tight">{lines.en}</p>}
          {lines.hi && (
            <p lang="hi" className="text-2xl md:text-3xl opacity-80 font-devanagari">
              {lines.hi}
            </p>
          )}
        </div>
        {result ? (
          <p lang="ko" className="mt-8 text-6xl md:text-7xl font-black tracking-tight animate-fadeIn" aria-label={word.ko}>
            {result.blocks.map((b, i) => (
              <span key={i} className={BLOCK_COLORS[b.status]}>
                {b.char}
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Type the Korean word</p>
        )}
      </div>

      {result ? (
        <>
          {typed && !result.correct && (
            <p className="text-center text-sm font-bold opacity-70">
              You typed <span lang="ko" className="font-black">{typed}</span>
            </p>
          )}
          <button
            onClick={next}
            className={`w-full py-4 rounded-2xl text-white font-black tracking-widest uppercase shadow-xl transition-all animate-fadeIn ${result.correct ? 'bg-gray-900 hover:bg-black' : result.nearMiss ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-700 hover:bg-rose-800'}`}
          >
            {verdict} · Continue
            <kbd className="hidden md:inline ml-3 text-[10px] bg-white/15 px-2 py-0.5 rounded">Enter</kbd>
          </button>
        </>
      ) : (
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) check();
          }}
        >
          <input
            ref={inputRef}
            lang="ko"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              // Korean keyboards compose syllables; wait until the block is finished.
              if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="한국어로 입력하세요"
            aria-label="Your answer in Korean"
            className="flex-1 min-w-0 px-5 py-4 rounded-2xl bg-white text-gray-900 text-2xl font-bold border border-black/10 outline-none focus:ring-4 focus:ring-indigo-200"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 sm:flex-none px-6 py-4 rounded-2xl bg-gray-900 text-white font-black text-xs tracking-widest uppercase hover:bg-black">
              Check
            </button>
            <button
              type="button"
              onClick={() => check(true)}
              className="flex-1 sm:flex-none px-4 py-4 rounded-2xl bg-white/80 text-gray-700 font-black text-xs tracking-widest uppercase hover:bg-white border border-black/5"
            >
              I don't know
            </button>
          </div>
        </form>
      )}

      {!result && (
        <button onClick={onDisableTyping} className="self-center text-[11px] font-bold underline opacity-60 hover:opacity-100">
          No Korean keyboard? Use multiple choice instead
        </button>
      )}
    </div>
  );
};

export default TypingQuiz;
