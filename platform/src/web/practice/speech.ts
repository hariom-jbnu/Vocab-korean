/**
 * Sound for words and sentences: a recorded file when the teacher uploaded
 * one, otherwise the device's text-to-speech voice for the language. When
 * the device has no voice for that language, callers show text instead.
 */
import { useEffect, useState } from 'react';

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

/** Voices load late in some browsers; this re-renders when they arrive. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => synth()?.getVoices() ?? []);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const update = () => setVoices(s.getVoices());
    update();
    s.addEventListener('voiceschanged', update);
    // Some browsers never fire the event; poll briefly.
    const t = setInterval(update, 500);
    const stop = setTimeout(() => clearInterval(t), 3000);
    return () => {
      s.removeEventListener('voiceschanged', update);
      clearInterval(t);
      clearTimeout(stop);
    };
  }, []);
  return voices;
}

export function findVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const want = lang.toLowerCase();
  const base = want.split('-')[0];
  return voices.find((v) => v.lang.toLowerCase() === want) ?? voices.find((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === base);
}

let current: HTMLAudioElement | null = null;

export function stopSound() {
  synth()?.cancel();
  current?.pause();
  current = null;
}

/** Speak text with the device voice. Resolves when done (or after a safety timeout). */
export function speak(text: string, lang: string, rate: number, voice?: SpeechSynthesisVoice): Promise<void> {
  const s = synth();
  if (!s || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? lang;
    if (voice) u.voice = voice;
    u.rate = rate;
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 1500 + text.length * 250);
    u.onend = done;
    u.onerror = done;
    s.speak(u);
  });
}

export function playFile(url: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    current?.pause();
    const a = new Audio(url);
    current = a;
    a.playbackRate = rate;
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
