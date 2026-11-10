import { useCallback, useEffect, useState } from 'react';

interface SpeechOptions {
  voiceName: string;
  rate: number;
  pitch: number;
}

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Korean text-to-speech through the browser's Web Speech API. */
export function useSpeech({ voiceName, rate, pitch }: SpeechOptions) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find((v) => v.name === voiceName);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);
    },
    [voices, voiceName, rate, pitch]
  );

  const hasKoreanVoice = voices.some((v) => v.lang.toLowerCase().startsWith('ko'));

  return { voices, speak, supported, hasKoreanVoice };
}
