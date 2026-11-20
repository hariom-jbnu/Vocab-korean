import React from 'react';
import type { VocabItem } from '../types';
import { findWordInSentence } from '../lib/planWords';

interface ExamplesProps {
  word: VocabItem;
  speak: (text: string) => void;
  /** Smaller text for tight spaces. */
  compact?: boolean;
  className?: string;
}

/** The word's example sentences: Korean (tap to hear) with the Hindi meaning. */
const Examples: React.FC<ExamplesProps> = ({ word, speak, compact = false, className = '' }) => {
  const examples = word.examples ?? [];
  if (examples.length === 0) return null;

  return (
    <section
      aria-label="Example sentences"
      className={`w-full bg-white/90 text-gray-900 rounded-[1.75rem] shadow-lg border border-black/5 ${compact ? 'p-4' : 'p-5 md:p-6'} ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">In a sentence</h2>
        {word.rom && <span className="text-xs font-semibold text-gray-400 truncate">{word.rom}</span>}
      </div>
      <ol className="space-y-3">
        {examples.map((ex, i) => {
          const hit = findWordInSentence(ex.ko, word.ko);
          return (
            <li key={i} className="flex items-start gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(ex.ko);
                }}
                title="Play this sentence"
                aria-label={`Play example ${i + 1}`}
                className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 active:scale-95 flex items-center justify-center transition-all"
              >
                <i className="bi bi-volume-up-fill text-sm"></i>
              </button>
              <div className="min-w-0">
                <p lang="ko" className={`${compact ? 'text-base' : 'text-lg md:text-xl'} font-bold leading-snug break-keep`}>
                  {hit ? (
                    <>
                      {ex.ko.slice(0, hit[0])}
                      <mark className="bg-amber-200/80 text-inherit rounded px-0.5">{ex.ko.slice(hit[0], hit[1])}</mark>
                      {ex.ko.slice(hit[1])}
                    </>
                  ) : (
                    ex.ko
                  )}
                </p>
                <p lang="hi" className={`${compact ? 'text-sm' : 'text-base'} text-gray-600 font-devanagari leading-snug mt-0.5`}>
                  {ex.hi}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default Examples;
