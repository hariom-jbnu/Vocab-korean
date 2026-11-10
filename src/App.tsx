
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Contact from './pages/Contact';
import Footer from './components/Footer';
import { VocabItem, ThemeType, Settings } from './types';
import { THEMES, LOGO_PATH } from './constants';
import { parseWords } from './lib/words';
import vocabCsv from '../data/ko_hi_en_vocab.csv?raw';

const App: React.FC = () => {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    voiceName: '',
    rate: 0.8,
    pitch: 1.0,
    autoSpeak: false,
    theme: ThemeType.NAVY,
    isRandom: false,
    cardBg: '#FFFFFF'
  });

  useEffect(() => {
    setVocab(parseWords(vocabCsv));
  }, []);

  const currentTheme = THEMES[settings.theme];

  return (
    <HashRouter>
      <div 
        className={`min-h-screen flex flex-col transition-colors duration-500 font-sans ${isFullScreen ? 'overflow-hidden' : ''}`}
        style={{ backgroundColor: currentTheme.background, color: currentTheme.text }}
      >
        {!isFullScreen && (
          <header className="sticky top-0 z-50 shadow-sm px-6 py-3 bg-white/95 backdrop-blur-md border-b border-black/5 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95">
              <img src={LOGO_PATH} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-sm border border-black/5" onError={(e) => {
                e.currentTarget.src = 'https://ui-avatars.com/api/?name=K-V&background=000&color=fff';
              }} />
            </Link>
            
            <nav className="flex items-center gap-8">
              <Link to="/" title="Flashcards" className="text-2xl text-gray-800 hover:text-blue-600 transition-all hover:scale-125">
                <i className="bi bi-card-text"></i>
              </Link>
              <Link to="/contact" title="Contact Us" className="text-2xl text-gray-800 hover:text-blue-600 transition-all hover:scale-125">
                <i className="bi bi-person-lines-fill"></i>
              </Link>
            </nav>
          </header>
        )}

        <main className={`flex-grow flex flex-col items-center justify-center w-full mx-auto ${isFullScreen ? 'p-0 h-screen' : 'p-4 md:p-8 max-w-6xl'}`}>
          <Routes>
            <Route 
              path="/" 
              element={
                <Home 
                  vocab={vocab} 
                  settings={settings} 
                  setSettings={setSettings} 
                  theme={currentTheme}
                  isFullScreen={isFullScreen}
                  setIsFullScreen={setIsFullScreen}
                />
              } 
            />
            <Route path="/contact" element={<Contact theme={currentTheme} />} />
          </Routes>
        </main>

        {!isFullScreen && <Footer theme={currentTheme} />}
      </div>
    </HashRouter>
  );
};

export default App;
