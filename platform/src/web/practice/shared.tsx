import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { Card, PracticeDeck } from '../../core/types';
import { ReportButton } from '../components/ui';
import { mediaUrl } from '../api';
import { findVoice, playFile, speak, stopSound, useVoices } from './speech';

/** Listen for keys while a round is on screen. Typing in a text box is left alone except Enter. */
export function useKeys(handler: (key: string, e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && e.key !== 'Enter' && e.key !== 'Escape') return;
      // A focused button already clicks itself on Enter or Space.
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'A') && (e.key === 'Enter' || e.key === ' ')) return;
      ref.current(e.key.length === 1 ? e.key.toLowerCase() : e.key, e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Play a card's word or sentence: uploaded audio first, then the device voice. */
export function useSpeaker(deck: PracticeDeck['deck']) {
  const voices = useVoices();
  const lang = deck.scriptMeta.ttsLang ?? deck.targetLang;
  const voice = findVoice(voices, lang);
  const hasTts = typeof window !== 'undefined' && 'speechSynthesis' in window && !!voice;
  const play = useCallback(
    async (text: string, opts: { audioMediaId?: string; rate?: number } = {}) => {
      stopSound();
      const rate = opts.rate ?? 1;
      if (opts.audioMediaId) return playFile(mediaUrl(opts.audioMediaId)!, rate);
      if (voice) return speak(text, lang, rate, voice);
    },
    [voice, lang]
  );
  useEffect(() => stopSound, []);
  return { play, hasTts, lang };
}

export function SpeakButton({ onClick, label = 'Play', small }: { onClick: () => void; label?: string; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'}`} aria-label={label}>
      🔊 {small ? '' : label}
    </button>
  );
}

export function Term({ card, deck, size = 'xl' }: { card: Card; deck: PracticeDeck['deck']; size?: 'xl' | 'lg' }) {
  return (
    <span lang={deck.targetLang} dir={deck.scriptMeta.direction} className={`font-bold ${size === 'xl' ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>
      {card.term}
    </span>
  );
}

/** After an answer: right or wrong, the full card, and Continue. */
export function Feedback({
  ok,
  near,
  card,
  deck,
  extra,
  onContinue,
}: {
  ok: boolean;
  near?: boolean;
  card: Card;
  deck: PracticeDeck['deck'];
  extra?: ReactNode;
  onContinue: () => void;
}) {
  const { play } = useSpeaker(deck);
  useKeys((k) => {
    if (k === 'Enter' || k === ' ') onContinue();
  });
  const ex = card.examples[0];
  return (
    <div className="space-y-4">
      <div className={`rounded-xl px-4 py-2 font-semibold ${ok ? (near ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800') : 'bg-red-50 text-red-800'}`}>
        {ok ? (near ? 'Almost! One small slip.' : 'Right!') : 'Not this time. Here it is:'}
      </div>
      {extra}
      <div className="flex flex-wrap items-baseline gap-3">
        <Term card={card} deck={deck} size="lg" />
        {card.reading && <span className="text-slate-500">{card.reading}</span>}
        <SpeakButton small onClick={() => play(card.term, { audioMediaId: card.audioMediaId })} />
      </div>
      <div>
        <div className="text-lg">{card.meaning}</div>
        {card.meaningAlt && <div className="text-slate-500">{card.meaningAlt}</div>}
      </div>
      {ex && (
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2" lang={deck.targetLang}>
            <span>{ex.text}</span>
            <SpeakButton small onClick={() => play(ex.text)} />
          </div>
          {ex.translation && <div className="text-sm text-slate-500">{ex.translation}</div>}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <ReportButton targetType="card" targetId={card.id} label="Report card" />
        <button className="btn-primary min-w-40" onClick={onContinue} autoFocus>
          Continue <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  );
}

/** First look at a new word, before it is tested. */
export function MeetCard({ card, deck, onDone }: { card: Card; deck: PracticeDeck['deck']; onDone: () => void }) {
  const { play } = useSpeaker(deck);
  useEffect(() => {
    void play(card.term, { audioMediaId: card.audioMediaId, rate: 0.9 });
  }, [card.id]);
  useKeys((k) => {
    if (k === ' ' || k === 'Enter') onDone();
    if (k === 'j' || k === 'r') void play(card.term, { audioMediaId: card.audioMediaId });
  });
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold tracking-wide text-brand uppercase">New word</div>
      <div className="flex flex-wrap items-baseline gap-3">
        <Term card={card} deck={deck} />
        {card.reading && <span className="text-lg text-slate-500">{card.reading}</span>}
        <SpeakButton onClick={() => play(card.term, { audioMediaId: card.audioMediaId })} />
      </div>
      <div>
        <div className="text-xl">{card.meaning}</div>
        {card.meaningAlt && <div className="text-slate-500">{card.meaningAlt}</div>}
      </div>
      {card.examples.map((ex, i) => (
        <div key={i} className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2" lang={deck.targetLang}>
            <span>{ex.text}</span>
            <SpeakButton small onClick={() => play(ex.text)} />
          </div>
          {ex.translation && <div className="text-sm text-slate-500">{ex.translation}</div>}
        </div>
      ))}
      <button className="btn-primary w-full" onClick={onDone} autoFocus>
        Got it, test me soon <span className="kbd">Space</span>
      </button>
    </div>
  );
}

export function shuffle<T>(list: readonly T[], random = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
