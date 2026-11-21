import React, { useEffect } from 'react';
import type { VisibilitySettings, VocabItem } from '../types';
import { meaningLines } from '../lib/quiz';
import { cardText, copyText } from '../lib/clipboard';
import { contrastText } from '../lib/color';
import Examples from './Examples';
import { useShortcuts } from '../hooks/useShortcuts';

interface MeetCardProps {
  word: VocabItem;
  visibility: VisibilitySettings;
  cardBg: string;
  badge: React.ReactNode;
  speak: (text: string) => void;
  /** "Got it": not graded; the word comes back a few cards later as a test. */
  onGotIt: () => void;
  paused: boolean;
}

/** A brand-new word, taught before it is ever tested: word, sound, meaning and two sentences. */
const MeetCard: React.FC<MeetCardProps> = ({ word, visibility, cardBg, badge, speak, onGotIt, paused }) => {
  useEffect(() => {
    speak(word.ko);
  }, [speak, word.ko]);

  useShortcuts((s) => {
    if (paused) return false;
    if (s.type === 'primary') onGotIt();
    else if (s.type === 'speak') speak(word.ko);
    else if (s.type === 'copy') copyText(cardText(word, 'full'));
    else return false;
    return true;
  });

  const lines = meaningLines(word, visibility);

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className="relative w-full flex flex-col justify-center items-center shadow-2xl rounded-[3rem] min-h-[300px] md:min-h-[340px] px-8 py-12 select-none cursor-pointer"
        style={{ backgroundColor: cardBg, color: contrastText(cardBg) }}
        onClick={() => speak(word.ko)}
      >
        {badge}
        <button
          onClick={(e) => {
            e.stopPropagation();
            speak(word.ko);
          }}
          title="Play audio (J)"
          aria-label="Play audio"
          aria-keyshortcuts="J R"
          className="absolute top-5 right-6 w-10 h-10 rounded-full flex items-center justify-center text-xl opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
        >
          <i className="bi bi-volume-up-fill"></i>
        </button>
        <h1 lang="ko" className="text-7xl md:text-8xl font-black tracking-tight leading-none text-center break-keep">
          {word.ko}
        </h1>
        {word.rom && <p className="mt-3 text-lg font-semibold opacity-60">{word.rom}</p>}
        <div className="w-16 h-[3px] bg-current opacity-25 rounded-full my-5"></div>
        {lines.en && <p className="text-3xl md:text-4xl font-bold leading-tight text-center">{lines.en}</p>}
        {lines.hi && (
          <p lang="hi" className="text-2xl md:text-3xl font-medium opacity-80 leading-tight font-devanagari text-center mt-1">
            {lines.hi}
          </p>
        )}
      </div>

      <Examples word={word} speak={speak} />

      <button
        onClick={onGotIt}
        className="w-full py-4 rounded-2xl bg-gray-900 text-white font-black tracking-widest uppercase shadow-xl hover:bg-black active:scale-[0.99] transition-all"
      >
        Got it · test me in a moment
        <kbd className="hidden md:inline ml-3 text-[10px] bg-white/15 px-2 py-0.5 rounded">Space</kbd>
      </button>
    </div>
  );
};

export default MeetCard;
