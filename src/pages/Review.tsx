import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Settings, ThemeColors, VisibilitySettings, VocabItem } from '../types';
import { useReviewSession } from '../hooks/useReviewSession';
import { formatInterval, GRADE_LABELS, GRADES, type Grade } from '../lib/srs';
import { contrastText } from '../lib/color';
import ChoiceQuiz from '../components/ChoiceQuiz';
import TypingQuiz from '../components/TypingQuiz';
import { chooseExercise } from '../lib/quiz';
import { stageOf, STAGE_INFO } from '../lib/stats';

interface ReviewProps {
  vocab: VocabItem[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  visibility: VisibilitySettings;
  theme: ThemeColors;
  speak: (text: string) => void;
  /** True when the browser has a Korean voice for the listening round. */
  canListen: boolean;
  /** Keyboard shortcuts pause while a dialog is open. */
  paused: boolean;
}

const GRADE_STYLES: Record<Grade, string> = {
  1: 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20',
  2: 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20',
  3: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20',
  4: 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/20',
};

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const Review: React.FC<ReviewProps> = ({ vocab, settings, setSettings, visibility, theme, speak, canListen, paused }) => {
  const session = useReviewSession(vocab, settings);
  const { current, revealed, reveal, answer, undo, canUndo } = session;
  const quiz = settings.answerMode === 'quiz';
  const exercise =
    quiz && current ? chooseExercise(session.currentCard, { canListen, canType: settings.typeAnswers }) : null;

  // Speak the word when a new card appears, unless the audio would give the answer away.
  const speakOnShow = settings.autoSpeak && exercise !== 'type' && exercise !== 'listen';
  useEffect(() => {
    if (current && speakOnShow) speak(current.ko);
  }, [current, speakOnShow, speak]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || isTyping(e.target) || e.metaKey || e.altKey) return;
      if ((e.key === 'z' && e.ctrlKey) || (e.key.toLowerCase() === 'u' && !e.ctrlKey)) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey || !current) return;
      if (e.key.toLowerCase() === 'r') {
        speak(current.ko);
      } else if (quiz) {
        // The quiz card handles its own keys.
      } else if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
      } else if (revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        answer(3);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        answer(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, quiz, current, revealed, reveal, answer, undo, speak]);

  if (session.loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 animate-pulse">
        <div className="w-16 h-16 border-4 border-black/5 border-t-black rounded-full animate-spin mb-6"></div>
        <p className="font-black opacity-50 uppercase tracking-widest text-[10px]">Loading your progress...</p>
      </div>
    );
  }

  const cardText = contrastText(settings.cardBg);
  const badge = (
    <span
      className={`absolute top-6 left-7 text-[9px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full ${session.isNew ? 'bg-emerald-500/15 text-emerald-600' : 'bg-sky-500/15 text-sky-600'}`}
    >
      {session.isNew ? 'New word' : STAGE_INFO[stageOf(session.currentCard)].label}
    </span>
  );
  const showEn = visibility.en || !visibility.hi;
  const showHi = visibility.hi || !visibility.en;
  const remaining = session.counts.due + session.counts.new;
  const progress = session.stats.answered / Math.max(1, session.stats.answered + remaining);

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-5 py-2 animate-fadeIn">
      {/* Today's counts */}
      <div className="w-full flex items-center justify-between gap-3 bg-white/40 px-4 py-3 rounded-2xl backdrop-blur-xl shadow-lg border border-white/40 text-gray-900">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
          <span title="Words due for review" className="flex items-center gap-1.5">
            <i className="bi bi-arrow-repeat text-sky-600 text-sm"></i>
            {session.counts.due} due
          </span>
          <span title="New words left today" className="flex items-center gap-1.5">
            <i className="bi bi-plus-circle text-emerald-600 text-sm"></i>
            {session.counts.new} new
          </span>
          <span title="Answers this session" className="hidden sm:flex items-center gap-1.5">
            <i className="bi bi-check2-circle text-gray-500 text-sm"></i>
            {session.stats.answered} done
          </span>
        </div>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo last answer (U)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 font-black text-[9px] tracking-widest border border-black/5 disabled:opacity-30 enabled:hover:bg-white transition-all"
        >
          <i className="bi bi-arrow-counterclockwise"></i>
          UNDO
        </button>
      </div>
      <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden -mt-2" aria-hidden="true">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%`, backgroundColor: theme.primary }} />
      </div>

      {session.storageError && (
        <p className="w-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 rounded-xl px-4 py-2">
          This browser is not letting the app save progress, so today's answers will be lost on reload.
        </p>
      )}

      {current && exercise === 'type' ? (
        <TypingQuiz
          key={session.cardKey}
          word={current}
          visibility={visibility}
          cardBg={settings.cardBg}
          badge={badge}
          speak={speak}
          onAnswer={answer}
          onDisableTyping={() => setSettings((prev) => ({ ...prev, typeAnswers: false }))}
          paused={paused}
        />
      ) : current && (exercise === 'choice' || exercise === 'listen') ? (
        <ChoiceQuiz
          key={session.cardKey}
          mode={exercise}
          word={current}
          pool={vocab}
          visibility={visibility}
          cardBg={settings.cardBg}
          badge={badge}
          speak={speak}
          onAnswer={answer}
          paused={paused}
        />
      ) : current ? (
        <>
          {/* Recall card */}
          <div
            className="relative w-full flex flex-col justify-center items-center shadow-2xl rounded-[3rem] h-[400px] md:h-[440px] px-8 cursor-pointer select-none transition-colors"
            style={{ backgroundColor: settings.cardBg, color: cardText }}
            onClick={() => (revealed ? speak(current.ko) : reveal())}
          >
            {badge}
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(current.ko);
              }}
              title="Play audio (R)"
              aria-label="Play audio"
              className="absolute top-5 right-6 w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
            >
              <i className="bi bi-volume-up-fill"></i>
            </button>

            <h1 lang="ko" className="text-7xl md:text-8xl font-black tracking-tight leading-none drop-shadow-sm text-center break-keep">
              {current.ko}
            </h1>

            {revealed ? (
              <div className="flex flex-col items-center text-center mt-8 space-y-3 animate-fadeIn">
                <div className="w-16 h-[3px] bg-current opacity-25 rounded-full mb-2"></div>
                {showEn && <p className="text-3xl md:text-4xl font-bold leading-tight">{current.en}</p>}
                {showHi && (
                  <p lang="hi" className="text-2xl md:text-3xl font-medium opacity-80 leading-tight font-devanagari">
                    {current.hi}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-10 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
                Recall the meaning, then tap
              </p>
            )}
          </div>

          {/* Answer controls */}
          {revealed && session.previews ? (
            <div className="w-full grid grid-cols-4 gap-2 md:gap-3">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => answer(g)}
                  className={`flex flex-col items-center py-3 md:py-4 rounded-2xl text-white shadow-lg active:scale-95 transition-all ${GRADE_STYLES[g]}`}
                >
                  <span className="text-sm md:text-base font-black">{GRADE_LABELS[g]}</span>
                  <span className="text-[10px] font-bold opacity-80">{formatInterval(new Date(), session.previews![g])}</span>
                  <kbd className="hidden md:block mt-1 text-[9px] font-black opacity-60">{g}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={reveal}
              className="w-full py-5 rounded-2xl bg-gray-900 text-white font-black tracking-widest uppercase shadow-xl hover:bg-black active:scale-[0.99] transition-all"
            >
              Show answer
              <kbd className="hidden md:inline ml-3 text-[10px] bg-white/15 px-2 py-0.5 rounded">Space</kbd>
            </button>
          )}

        </>
      ) : null}

      {current && (
        <p className="hidden md:flex flex-wrap justify-center gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
          {exercise === 'type' ? (
            <span>Enter check · Enter continue</span>
          ) : quiz ? (
            <span>1-4 pick · Space continue</span>
          ) : (
            <span>Space reveal / good · 1-4 rate</span>
          )}
          <span>R audio</span>
          <span>U undo</span>
        </p>
      )}

      {!current && (
        <DoneCard session={session} newPerDay={settings.newPerDay} />
      )}
    </div>
  );
};

const DoneCard: React.FC<{ session: ReturnType<typeof useReviewSession>; newPerDay: number }> = ({ session, newPerDay }) => {
  const { stats, dueTomorrow, newDoneToday } = session;
  return (
    <div className="w-full bg-white rounded-[3rem] shadow-2xl p-10 text-center text-gray-900 animate-fadeIn">
      <div className="text-5xl mb-4">
        <i className="bi bi-patch-check-fill text-emerald-500"></i>
      </div>
      <h2 className="text-3xl font-black tracking-tight mb-2">All done for today</h2>
      <p className="text-gray-500 font-medium mb-8">
        {stats.answered > 0
          ? `You answered ${stats.answered} cards and started ${stats.newLearned} new words.`
          : newDoneToday >= newPerDay && newPerDay > 0
            ? `You have already learned today's ${newPerDay} new words.`
            : 'Nothing is due right now.'}{' '}
        {dueTomorrow > 0 ? `${dueTomorrow} reviews are due by tomorrow.` : 'Come back tomorrow for your next reviews.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={() => session.learnMore(5)}
          className="px-6 py-4 rounded-2xl bg-gray-900 text-white font-black text-xs tracking-widest uppercase hover:bg-black transition-all"
        >
          Learn 5 more words
        </button>
        <Link
          to="/browse"
          className="px-6 py-4 rounded-2xl bg-gray-100 text-gray-800 font-black text-xs tracking-widest uppercase hover:bg-gray-200 transition-all"
        >
          Browse all words
        </Link>
      </div>
    </div>
  );
};

export default Review;
