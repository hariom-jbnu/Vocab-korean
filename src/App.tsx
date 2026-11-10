import React, { useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import Review from './pages/Review';
import Browse from './pages/Browse';
import Stats from './pages/Stats';
import Contact from './pages/Contact';
import Footer from './components/Footer';
import SettingsPanel from './components/SettingsPanel';
import { ThemeType, Settings, VisibilitySettings } from './types';
import { THEMES, LOGO_PATH } from './constants';
import { parseWords } from './lib/words';
import { DEFAULT_RETENTION } from './lib/srs';
import { usePersistentState } from './hooks/usePersistentState';
import { useSpeech } from './hooks/useSpeech';
import { useDailyProgress, type DailyProgress } from './hooks/useDailyProgress';
import vocabCsv from '../data/ko_hi_en_vocab.csv?raw';

const DEFAULT_SETTINGS: Settings = {
  voiceName: '',
  rate: 0.8,
  pitch: 1.0,
  autoSpeak: false,
  theme: ThemeType.NAVY,
  isRandom: false,
  cardBg: '#FFFFFF',
  newPerDay: 10,
  dailyGoal: 20,
  retention: DEFAULT_RETENTION,
  // Picked once and saved, so each learner keeps the same new-word order.
  seed: Math.floor(Math.random() * 2 ** 31),
  answerMode: 'quiz',
  typeAnswers: true,
};

const NAV = [
  { to: '/', icon: 'bi-lightning-charge-fill', label: 'Review' },
  { to: '/stats', icon: 'bi-bar-chart-fill', label: 'Stats' },
  { to: '/browse', icon: 'bi-card-text', label: 'Browse' },
  { to: '/contact', icon: 'bi-person-lines-fill', label: 'Contact' },
];

/** Day streak plus today's progress toward the daily goal. */
const StreakBadge: React.FC<{ daily: DailyProgress; goal: number }> = ({ daily, goal }) => {
  const { streak, today } = daily;
  const pct = Math.min(1, today / Math.max(1, goal));
  return (
    <Link
      to="/stats"
      title={`${streak.current}-day streak · ${today} of ${goal} answers today`}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-black/5 transition-all"
    >
      <i className={`bi bi-fire text-xl ${streak.todayCounts ? 'text-orange-500' : 'text-gray-300'}`}></i>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-black">{streak.current}</span>
        <span className="mt-1 w-8 h-1 rounded-full bg-gray-200 overflow-hidden">
          <span className="block h-full rounded-full bg-orange-500" style={{ width: `${pct * 100}%` }} />
        </span>
      </span>
      <span className="sr-only">day streak</span>
    </Link>
  );
};

const App: React.FC = () => {
  const vocab = useMemo(() => parseWords(vocabCsv), []);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = usePersistentState<Settings>('settings', DEFAULT_SETTINGS);
  const [visibility, setVisibility] = usePersistentState<VisibilitySettings>('visibility', { ko: true, hi: true, en: true });
  const { voices, speak, supported, hasKoreanVoice } = useSpeech(settings);
  const daily = useDailyProgress();

  const currentTheme = THEMES[settings.theme] ?? THEMES[ThemeType.NAVY];
  const openSettings = () => setIsSettingsOpen(true);

  return (
    <HashRouter>
      <div
        className={`min-h-screen flex flex-col transition-colors duration-500 font-sans ${isFullScreen ? 'overflow-hidden' : ''}`}
        style={{ backgroundColor: currentTheme.background, color: currentTheme.text }}
      >
        {!isFullScreen && (
          <header className="sticky top-0 z-50 shadow-sm px-3 md:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-black/5 flex items-center justify-between text-gray-800">
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <Link to="/" className="shrink-0 transition-transform hover:scale-105 active:scale-95">
                <img src={LOGO_PATH} alt="Vocab Korean" className="w-10 h-10 rounded-xl object-cover shadow-sm border border-black/5" />
              </Link>
              {daily && <StreakBadge daily={daily} goal={settings.dailyGoal} />}
            </div>

            <nav className="flex items-center md:gap-3">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  title={item.label}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl transition-all hover:bg-black/5 ${isActive ? 'text-indigo-600' : 'text-gray-800'}`
                  }
                >
                  <i className={`bi ${item.icon} text-xl`}></i>
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                </NavLink>
              ))}
              <button onClick={openSettings} title="Settings" aria-label="Settings" className="px-2 sm:px-3 py-2 rounded-xl hover:bg-black/5 transition-all">
                <i className="bi bi-gear-fill text-xl"></i>
              </button>
            </nav>
          </header>
        )}

        <main className={`flex-grow flex flex-col items-center justify-center w-full mx-auto ${isFullScreen ? 'p-0 h-screen' : 'p-4 md:p-8 max-w-6xl'}`}>
          <Routes>
            <Route
              path="/"
              element={
                <Review
                  daily={daily}
                  vocab={vocab}
                  settings={settings}
                  setSettings={setSettings}
                  visibility={visibility}
                  theme={currentTheme}
                  speak={speak}
                  canListen={supported && hasKoreanVoice}
                  paused={isSettingsOpen}
                />
              }
            />
            <Route
              path="/browse"
              element={
                <Browse
                  vocab={vocab}
                  settings={settings}
                  setSettings={setSettings}
                  visibility={visibility}
                  speak={speak}
                  isFullScreen={isFullScreen}
                  setIsFullScreen={setIsFullScreen}
                  onOpenSettings={openSettings}
                />
              }
            />
            <Route path="/stats" element={<Stats vocab={vocab} settings={settings} speak={speak} daily={daily} />} />
            <Route path="/contact" element={<Contact theme={currentTheme} />} />
          </Routes>
        </main>

        {!isFullScreen && <Footer theme={currentTheme} />}

        {isSettingsOpen && (
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            visibility={visibility}
            setVisibility={setVisibility}
            voices={voices}
            theme={currentTheme}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </div>
    </HashRouter>
  );
};

export default App;
