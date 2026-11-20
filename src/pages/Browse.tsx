import React, { useEffect, useCallback, useRef, useState } from 'react';
import { VocabItem, Settings, VisibilitySettings } from '../types';
import { CARD_PALETTE } from '../constants';
import { usePersistentState } from '../hooks/usePersistentState';
import { contrastText } from '../lib/color';
import Examples from '../components/Examples';
import { openShortcutList } from '../components/ShortcutHelp';
import { useShortcuts } from '../hooks/useShortcuts';
import { isFullscreenKey, numberKey } from '../lib/shortcuts';

interface BrowseProps {
  vocab: VocabItem[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  visibility: VisibilitySettings;
  setVisibility: React.Dispatch<React.SetStateAction<VisibilitySettings>>;
  speak: (text: string) => void;
  isFullScreen: boolean;
  setIsFullScreen: (val: boolean) => void;
  onOpenSettings: () => void;
}

/** What the number keys 1 to 3 show or hide (4 is the sentences). */
const PARTS: { key: keyof VisibilitySettings; name: string }[] = [
  { key: 'ko', name: 'Korean' },
  { key: 'en', name: 'English' },
  { key: 'hi', name: 'Hindi' },
];

/** The keys shown under the card, and along the bottom in full screen. */
const HINTS: { keys: string[]; label: string }[] = [
  { keys: ['←', '→'], label: 'words' },
  { keys: ['J'], label: 'word' },
  { keys: ['K', 'L'], label: 'sentences' },
  { keys: ['1', '2', '3', '4'], label: 'show / hide' },
  { keys: ['N'], label: 'number' },
  { keys: ['M'], label: 'shuffle' },
  { keys: ['V'], label: 'auto-play' },
  { keys: ['C'], label: 'color' },
  { keys: ['F'], label: 'full screen' },
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="bg-white px-1.5 py-0.5 rounded border border-black/5 shadow-sm text-gray-800 font-black">{children}</kbd>
);

/** Flip through the whole word list, in order or at random. */
const Browse: React.FC<BrowseProps> = ({
  vocab,
  settings,
  setSettings,
  visibility,
  setVisibility,
  speak,
  isFullScreen,
  setIsFullScreen,
  onOpenSettings,
}) => {
  const [savedIndex, setCurrentIndex] = usePersistentState('browse:index', 0);
  const [showExamples, setShowExamples] = usePersistentState('browse:examples', true);
  const currentIndex = vocab.length > 0 ? Math.min(Math.max(savedIndex, 0), vocab.length - 1) : 0;
  const lastIndex = useRef(0);
  const jumpRef = useRef<HTMLInputElement>(null);

  // A short note after a key changes something, e.g. "Shuffle on".
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 1400);
  }, []);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const handleNext = useCallback(() => {
    if (vocab.length === 0) return;
    if (settings.isRandom) {
      let nextIdx;
      do {
        nextIdx = Math.floor(Math.random() * vocab.length);
      } while (nextIdx === currentIndex && vocab.length > 1);
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex(prev => (prev + 1) % vocab.length);
    }
  }, [vocab, settings.isRandom, currentIndex]);

  const handlePrev = useCallback(() => {
    if (vocab.length === 0) return;
    if (settings.isRandom) {
      handleNext();
    } else {
      setCurrentIndex(prev => (prev - 1 + vocab.length) % vocab.length);
    }
  }, [vocab, settings.isRandom, handleNext]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
    }
  }, [setIsFullScreen]);

  const toggleShuffle = () => {
    const on = !settings.isRandom;
    setSettings(prev => ({ ...prev, isRandom: on }));
    flash(on ? 'Shuffle on' : 'In order');
  };

  const toggleAutoPlay = () => {
    const on = !settings.autoSpeak;
    setSettings(prev => ({ ...prev, autoSpeak: on }));
    flash(on ? 'Auto-play on' : 'Auto-play off');
  };

  const nextColor = () => {
    const i = (CARD_PALETTE.indexOf(settings.cardBg) + 1) % CARD_PALETTE.length;
    setSettings(prev => ({ ...prev, cardBg: CARD_PALETTE[i] }));
    flash(`Card color ${i + 1} of ${CARD_PALETTE.length}`);
  };

  const togglePart = (n: 1 | 2 | 3 | 4) => {
    if (n === 4) {
      setShowExamples(!showExamples);
      flash(showExamples ? 'Sentences hidden' : 'Sentences shown');
      return;
    }
    const part = PARTS[n - 1];
    setVisibility(prev => ({ ...prev, [part.key]: !prev[part.key] }));
    flash(`${part.name} ${visibility[part.key] ? 'hidden' : 'shown'}`);
  };

  const goTo = (i: number) => {
    setCurrentIndex(i);
    flash(`Word ${i + 1}`);
  };

  const focusJump = () => {
    jumpRef.current?.focus();
    jumpRef.current?.select();
  };

  useShortcuts((s, e) => {
    if (vocab.length === 0) return false;
    // F is answer 4 in study; here it is full screen.
    if (isFullscreenKey(e)) toggleFullScreen();
    else if (s.type === 'next' || s.type === 'primary') handleNext();
    else if (s.type === 'prev') handlePrev();
    else if (s.type === 'speak') speak(vocab[currentIndex].ko);
    else if (s.type === 'first') goTo(0);
    else if (s.type === 'last') goTo(vocab.length - 1);
    else if (s.type === 'jump') focusJump();
    else if (s.type === 'shuffle') toggleShuffle();
    else if (s.type === 'autoplay') toggleAutoPlay();
    else if (s.type === 'color') nextColor();
    else if (s.type === 'answer' && numberKey(e)) togglePart(numberKey(e)!);
    else return false;
    return true;
  });

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [setIsFullScreen]);

  // Leaving Browse (H, P, G or B in full screen) also leaves full screen.
  useEffect(
    () => () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    },
    [setIsFullScreen]
  );

  useEffect(() => {
    if (settings.autoSpeak && vocab.length > 0 && lastIndex.current !== currentIndex) {
      speak(vocab[currentIndex].ko);
    }
    lastIndex.current = currentIndex;
  }, [currentIndex, vocab, settings.autoSpeak, speak]);

  const handleJump = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('jump') as HTMLInputElement;
    const val = parseInt(input.value) - 1;
    if (val >= 0 && val < vocab.length) {
      setCurrentIndex(val);
    }
    // Give the keys back to the page.
    input.blur();
  };

  if (vocab.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 animate-pulse">
        <div className="w-16 h-16 border-4 border-black/5 border-t-black rounded-full animate-spin mb-6"></div>
        <p className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Assembling library...</p>
      </div>
    );
  }

  const currentWord = vocab[currentIndex];
  const textContrast = contrastText(settings.cardBg);
  const hasExamples = showExamples && (currentWord.examples?.length ?? 0) > 0;

  // In full screen the text grows with the screen, smaller when the sentences need room.
  const sizes = !isFullScreen
    ? { ko: 'text-7xl md:text-[8rem]', en: 'text-3xl md:text-4xl', hi: 'text-2xl md:text-3xl' }
    : hasExamples
      ? {
          ko: 'text-[length:clamp(3.5rem,min(15vh,13vw),11rem)]',
          en: 'text-[length:clamp(1.5rem,5.5vh,4rem)]',
          hi: 'text-[length:clamp(1.25rem,4.5vh,3.25rem)]',
        }
      : {
          ko: 'text-[length:clamp(4rem,min(24vh,16vw),14rem)]',
          en: 'text-[length:clamp(2rem,8vh,6rem)]',
          hi: 'text-[length:clamp(1.75rem,6.5vh,4.5rem)]',
        };

  const jumpForm = (
    <form onSubmit={handleJump} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
      <input
        ref={jumpRef}
        name="jump"
        type="number"
        min="1"
        max={vocab.length}
        defaultValue={currentIndex + 1}
        key={currentIndex}
        aria-label="Word number"
        title="Go to a word number (N)"
        aria-keyshortcuts="N"
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
        className="w-20 px-2 py-1.5 rounded-xl bg-white/80 text-gray-900 border border-black/5 text-center font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/50"
      />
      <span className="font-black text-[9px] uppercase opacity-50">/ {vocab.length}</span>
      <button type="submit" className="px-4 py-1.5 bg-gray-900 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-all text-[9px] tracking-widest">GO</button>
    </form>
  );

  const shuffleButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleShuffle();
      }}
      title="Shuffle on or off (M)"
      aria-keyshortcuts="M"
      className="flex items-center gap-2 uppercase tracking-[0.2em] hover:opacity-100 transition-opacity"
    >
      <i className={`bi ${settings.isRandom ? 'bi-shuffle' : 'bi-border-width'} text-indigo-500`}></i>
      {settings.isRandom ? 'RANDOM' : 'SEQUENTIAL'}
    </button>
  );

  const hints = (
    <>
      {HINTS.map((h) => (
        <span key={h.label} className="flex items-center gap-1">
          {h.keys.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}{' '}
          {h.label}
        </span>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openShortcutList();
        }}
        className="flex items-center gap-1 uppercase tracking-[0.2em] hover:opacity-100"
      >
        <Kbd>?</Kbd> all keys
      </button>
    </>
  );

  return (
    <div className={`w-full flex flex-col items-center transition-all duration-500 ${isFullScreen ? 'h-screen justify-center' : 'space-y-6 py-2'}`}>
      {!isFullScreen && (
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 bg-white/40 p-3 rounded-2xl backdrop-blur-xl shadow-lg border border-white/40 text-gray-500">
          <div className="flex items-center gap-4">{jumpForm}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullScreen}
              title="Full screen (F)"
              aria-keyshortcuts="F"
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/80 text-gray-800 font-black hover:bg-white transition-all text-[9px] shadow-sm border border-black/5"
            >
              <i className="bi bi-arrows-fullscreen"></i>
              FULL SCREEN
            </button>
            <button
              onClick={onOpenSettings}
              title="Settings (,)"
              aria-keyshortcuts=","
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/80 text-gray-800 font-black hover:bg-white transition-all text-[9px] shadow-sm border border-black/5"
            >
              <i className="bi bi-gear-fill"></i>
              SETTINGS
            </button>
          </div>
        </div>
      )}

      {/* Modern Flashcard Container */}
      <div className={`w-full relative transition-all duration-700 ease-in-out ${isFullScreen ? 'max-w-none h-screen' : 'max-w-2xl px-2'}`}>
        <div
          className={`group relative flex flex-col justify-center items-center shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden ${isFullScreen ? 'h-full rounded-none' : 'h-[480px] md:h-[520px] rounded-[3.5rem]'}`}
          style={{ backgroundColor: settings.cardBg, color: textContrast }}
          onClick={() => speak(currentWord.ko)}
        >
          {/* Card Color Picker */}
          {!isFullScreen && (
            <div className="absolute top-6 right-6 z-20">
              <div className="grid grid-cols-3 gap-1 p-2 bg-black/10 rounded-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/20">
                {CARD_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={(e) => { e.stopPropagation(); setSettings(prev => ({ ...prev, cardBg: color })); }}
                    className={`w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-150 ${settings.cardBg === color ? 'ring-2 ring-indigo-500 shadow-sm' : ''}`}
                    style={{ backgroundColor: color }}
                    title={`${color} (C: next color)`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Full screen: word number on the left, shuffle and exit on the right. */}
          {isFullScreen && (
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-4 text-[9px] font-black uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition-opacity">
              {jumpForm}
              <div className="flex items-center gap-4">
                {shuffleButton}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullScreen();
                  }}
                  title="Leave full screen (F or Esc)"
                  aria-label="Leave full screen"
                  className="w-9 h-9 rounded-xl bg-black/10 hover:bg-black/20 flex items-center justify-center text-base"
                >
                  <i className="bi bi-fullscreen-exit"></i>
                </button>
              </div>
            </div>
          )}

          {note && (
            <div
              role="status"
              className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-gray-900/85 text-white text-xs font-black tracking-wide shadow-lg pointer-events-none"
            >
              {note}
            </div>
          )}

          <div
            className={`flex flex-col items-center text-center w-full z-10 ${isFullScreen ? 'max-w-6xl max-h-full overflow-y-auto px-6 md:px-12 pt-[9vh] pb-[11vh] gap-[3vh]' : 'max-w-5xl px-10 space-y-10'}`}
          >
            {visibility.ko && (
              <h1 className={`${sizes.ko} font-black tracking-tighter leading-none select-none drop-shadow-md`}>
                {currentWord.ko}
              </h1>
            )}

            {(visibility.en || visibility.hi) && <div className="w-20 h-[3px] bg-current opacity-30 rounded-full shrink-0"></div>}

            <div className={`${isFullScreen ? 'space-y-[1.5vh]' : 'space-y-4'} w-full`}>
              {visibility.en && (
                <p className={`${sizes.en} font-bold opacity-100 leading-tight tracking-tight`}>
                  {currentWord.en}
                </p>
              )}
              {visibility.hi && (
                <p className={`${sizes.hi} font-medium opacity-80 leading-tight font-devanagari`}>
                  {currentWord.hi}
                </p>
              )}
            </div>

            {isFullScreen ? (
              <Examples word={currentWord} speak={speak} size="large" hidden={!showExamples} className="max-w-4xl shrink-0" />
            ) : (
              <div className="pt-8 opacity-40 flex flex-col items-center gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.5em] animate-pulse">Touch to Speak</span>
              </div>
            )}
          </div>

          {isFullScreen ? (
            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-[9px] font-black uppercase tracking-[0.2em] opacity-50 hover:opacity-100 transition-opacity">
              {hints}
            </div>
          ) : (
            /* Nav Icons Visual Cues inside the card */
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-10 text-2xl opacity-10">
              <i className="bi bi-arrow-left"></i>
              <i className="bi bi-arrow-right"></i>
            </div>
          )}
        </div>

        {/* Side Nav Buttons */}
        {!isFullScreen && (
          <>
            <button
              onClick={handlePrev}
              title="Previous word (←)"
              aria-label="Previous word"
              className="absolute -left-2 md:-left-16 top-1/2 -translate-y-1/2 w-12 md:w-14 h-12 md:h-14 flex items-center justify-center bg-white/90 backdrop-blur-md text-gray-900 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all text-xl border border-black/5"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              onClick={handleNext}
              title="Next word (→ or Space)"
              aria-label="Next word"
              className="absolute -right-2 md:-right-16 top-1/2 -translate-y-1/2 w-12 md:w-14 h-12 md:h-14 flex items-center justify-center bg-white/90 backdrop-blur-md text-gray-900 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all text-xl border border-black/5"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </>
        )}
      </div>

      {!isFullScreen && <Examples word={currentWord} speak={speak} hidden={!showExamples} className="max-w-2xl" />}

      {!isFullScreen && (
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 px-6 py-2 bg-black/5 rounded-3xl text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
          {shuffleButton}
          {/* Phones have no keyboard, so the key list shows from tablet size up. */}
          <span className="hidden md:contents">
            <span className="opacity-20">|</span>
            {hints}
          </span>
        </div>
      )}
    </div>
  );
};

export default Browse;
