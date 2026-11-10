
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VocabItem, Settings, VisibilitySettings, ThemeColors } from '../types';
import SettingsPanel from '../components/SettingsPanel';
import { CARD_PALETTE } from '../constants';

interface HomeProps {
  vocab: VocabItem[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  theme: ThemeColors;
  isFullScreen: boolean;
  setIsFullScreen: (val: boolean) => void;
}

const Home: React.FC<HomeProps> = ({ vocab, settings, setSettings, theme, isFullScreen, setIsFullScreen }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibility, setVisibility] = useState<VisibilitySettings>({ ko: true, hi: true, en: true });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const lastIndex = useRef(0);

  useEffect(() => {
    const handleVoicesChanged = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    handleVoicesChanged();
  }, []);

  const speak = useCallback((text: string) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = voices.find(v => v.name === settings.voiceName);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.lang = 'ko-KR';
    window.speechSynthesis.speak(utterance);
  }, [voices, settings]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Enter') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
        } else {
          document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, setIsFullScreen]);

  useEffect(() => {
    const handleFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [setIsFullScreen]);

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
  
  // High-precision contrast calculator for readability
  const getContrastColor = (hex: string) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#0F172A' : '#F8FAFC';
  };

  const textContrast = getContrastColor(settings.cardBg);

  return (
    <div className={`w-full flex flex-col items-center transition-all duration-500 ${isFullScreen ? 'h-screen justify-center' : 'space-y-6 py-2'}`}>
      
      {!isFullScreen && (
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 bg-white/40 p-3 rounded-2xl backdrop-blur-xl shadow-lg border border-white/40">
          <div className="flex items-center gap-4">
            <form onSubmit={handleJump} className="flex items-center gap-2">
              <input 
                name="jump"
                type="number" 
                min="1" 
                max={vocab.length} 
                defaultValue={currentIndex + 1}
                key={currentIndex}
                className="w-16 px-2 py-1.5 rounded-xl bg-white/80 text-gray-900 border border-black/5 text-center font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <span className="text-gray-500 font-black text-[9px] uppercase opacity-50">/ {vocab.length}</span>
              <button type="submit" className="px-4 py-1.5 bg-gray-900 text-white rounded-xl font-black hover:scale-105 active:scale-95 transition-all text-[9px] tracking-widest">GO</button>
            </form>
          </div>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/80 text-gray-800 font-black hover:bg-white transition-all text-[9px] shadow-sm border border-black/5"
          >
            <i className="bi bi-gear-fill"></i>
            SETTINGS
          </button>
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
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex flex-col items-center text-center space-y-10 w-full max-w-5xl px-10 z-10">
            {visibility.ko && (
              <h1 className={`${isFullScreen ? 'text-9xl md:text-[14rem]' : 'text-7xl md:text-[8rem]'} font-black tracking-tighter leading-none select-none drop-shadow-md`}>
                {currentWord.ko}
              </h1>
            )}
            
            {(visibility.en || visibility.hi) && <div className="w-20 h-[3px] bg-current opacity-30 rounded-full"></div>}

            <div className="space-y-4 w-full">
              {visibility.en && (
                <p className={`${isFullScreen ? 'text-6xl md:text-8xl' : 'text-3xl md:text-4xl'} font-bold opacity-100 leading-tight tracking-tight`}>
                  {currentWord.en}
                </p>
              )}
              {visibility.hi && (
                <p className={`${isFullScreen ? 'text-5xl md:text-7xl' : 'text-2xl md:text-3xl'} font-medium opacity-80 leading-tight font-devanagari`}>
                  {currentWord.hi}
                </p>
              )}
            </div>
            
            <div className="pt-8 opacity-40 flex flex-col items-center gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.5em] animate-pulse">Touch to Speak</span>
            </div>
          </div>

          {/* Nav Icons Visual Cues inside the card */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-10 text-2xl opacity-10">
             <i className="bi bi-arrow-left"></i>
             <i className="bi bi-arrow-right"></i>
          </div>
        </div>

        {/* Side Nav Buttons */}
        {!isFullScreen && (
          <>
            <button 
              onClick={handlePrev}
              className="absolute -left-2 md:-left-16 top-1/2 -translate-y-1/2 w-12 md:w-14 h-12 md:h-14 flex items-center justify-center bg-white/90 backdrop-blur-md text-gray-900 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all text-xl border border-black/5"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button 
              onClick={handleNext}
              className="absolute -right-2 md:-right-16 top-1/2 -translate-y-1/2 w-12 md:w-14 h-12 md:h-14 flex items-center justify-center bg-white/90 backdrop-blur-md text-gray-900 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all text-xl border border-black/5"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </>
        )}
      </div>

      {!isFullScreen && (
        <div className="flex flex-wrap justify-center items-center gap-4 px-6 py-2 bg-black/5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
           <span className="flex items-center gap-2">
             <i className={`bi ${settings.isRandom ? 'bi-shuffle' : 'bi-border-width'} text-indigo-500`}></i>
             {settings.isRandom ? 'RANDOM' : 'SEQUENTIAL'}
           </span>
           <span className="opacity-20">|</span>
           <span className="flex items-center gap-1"><kbd className="bg-white px-1.5 py-0.5 rounded border border-black/5 shadow-sm text-gray-800">Enter</kbd> FS</span>
        </div>
      )}

      {isSettingsOpen && (
        <SettingsPanel 
          settings={settings}
          setSettings={setSettings}
          visibility={visibility}
          setVisibility={setVisibility}
          voices={voices}
          theme={theme}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;
