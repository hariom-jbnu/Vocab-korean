
import React from 'react';
import { Settings, ThemeType, VisibilitySettings, ThemeColors } from '../types';
import DataSection from './DataSection';

interface SettingsPanelProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  visibility: VisibilitySettings;
  setVisibility: React.Dispatch<React.SetStateAction<VisibilitySettings>>;
  voices: SpeechSynthesisVoice[];
  theme: ThemeColors;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  setSettings, 
  visibility, 
  setVisibility, 
  voices, 
  theme,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 overflow-hidden relative border border-black/5" style={{ color: '#111827' }}>
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <h2 className="text-3xl font-black mb-8 tracking-tight">Settings</h2>

        <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          {/* Daily study */}
          <section className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Daily Study</h3>
            <div>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Answer style</span>
              <div className="flex gap-2">
                {([
                  ['quiz', 'bi-ui-checks-grid', 'Quiz', 'The app checks your answer'],
                  ['flip', 'bi-hand-index-thumb', 'Flip', 'You rate yourself'],
                ] as const).map(([mode, icon, label, hint]) => (
                  <button
                    key={mode}
                    onClick={() => setSettings(prev => ({ ...prev, answerMode: mode }))}
                    className={`flex-1 py-3 px-2 rounded-2xl font-bold flex flex-col items-center gap-0.5 transition-all ${settings.answerMode === mode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <span className="flex items-center gap-2 text-[10px] uppercase"><i className={`bi ${icon}`}></i>{label}</span>
                    <span className="text-[10px] font-medium opacity-80">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            {settings.answerMode === 'quiz' && (
              <label className="flex items-center justify-between gap-4 cursor-pointer p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                <span>
                  <span className="block text-sm font-black text-gray-700">Typing round</span>
                  <span className="block text-[11px] text-gray-400">Type well-known words in Korean (needs a Korean keyboard)</span>
                </span>
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-indigo-600"
                  checked={settings.typeAnswers}
                  onChange={() => setSettings(prev => ({ ...prev, typeAnswers: !prev.typeAnswers }))}
                />
              </label>
            )}
            <div>
              <label htmlFor="new-per-day" className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
                New words per day ({settings.newPerDay})
              </label>
              <input
                id="new-per-day"
                type="range" min="0" max="30" step="1"
                value={settings.newPerDay}
                onChange={(e) => setSettings(prev => ({ ...prev, newPerDay: parseInt(e.target.value, 10) }))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-gray-400 mt-1">Each new word brings a few reviews a day for the next week, so start small.</p>
            </div>
            <div>
              <label htmlFor="daily-goal" className="block text-[10px] font-bold text-gray-500 uppercase mb-2">
                Daily goal ({settings.dailyGoal} answers)
              </label>
              <input
                id="daily-goal"
                type="range" min="5" max="100" step="5"
                value={settings.dailyGoal}
                onChange={(e) => setSettings(prev => ({ ...prev, dailyGoal: parseInt(e.target.value, 10) }))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-gray-400 mt-1">Any day with at least 5 answers keeps your streak going.</p>
            </div>
            <div>
              <label htmlFor="retention" className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Target recall</label>
              <select
                id="retention"
                className="w-full p-3 rounded-2xl border bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                value={settings.retention}
                onChange={(e) => setSettings(prev => ({ ...prev, retention: parseFloat(e.target.value) }))}
              >
                <option value={0.8}>80%: fewer reviews</option>
                <option value={0.85}>85%</option>
                <option value={0.9}>90%: recommended</option>
                <option value={0.95}>95%: exam prep, more reviews</option>
              </select>
            </div>
          </section>

          {/* Theme Selection */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Background Palette</h3>
            <div className="flex gap-4">
              {(Object.keys(ThemeType) as Array<keyof typeof ThemeType>).map((t) => (
                <button
                  key={t}
                  onClick={() => setSettings(prev => ({ ...prev, theme: t as ThemeType }))}
                  className={`w-12 h-12 rounded-2xl border-4 transition-all hover:scale-110 active:scale-95 shadow-sm ${settings.theme === t ? 'border-indigo-500 scale-105 shadow-md' : 'border-white'}`}
                  style={{ backgroundColor: t === 'TEAL' ? '#005461' : t === 'NAVY' ? '#30364F' : '#F5AFAF' }}
                  title={t}
                />
              ))}
            </div>
          </section>

          {/* Random / Sequential Toggle */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Browse Order</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSettings(prev => ({ ...prev, isRandom: false }))}
                className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${!settings.isRandom ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <i className="bi bi-border-width"></i>
                <span className="text-[10px]">SEQUENTIAL</span>
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, isRandom: true }))}
                className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${settings.isRandom ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <i className="bi bi-shuffle"></i>
                <span className="text-[10px]">RANDOM</span>
              </button>
            </div>
          </section>

          {/* Visibility Toggles */}
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">Display Languages</h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(visibility) as Array<keyof VisibilitySettings>).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setVisibility(prev => ({ ...prev, [lang]: !prev[lang] }))}
                  className={`py-3 rounded-2xl text-xs font-black transition-all ${visibility[lang] ? 'bg-gray-900 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          {/* TTS Controls */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Audio Settings</h3>
            
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Native Voice</label>
              <select 
                className="w-full p-3 rounded-2xl border bg-gray-50 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                value={settings.voiceName}
                onChange={(e) => setSettings(prev => ({ ...prev, voiceName: e.target.value }))}
              >
                <option value="">System Default</option>
                {voices.filter(v => v.lang.includes('ko')).map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Speed ({settings.rate}x)</label>
                <input 
                  type="range" min="0.5" max="2" step="0.1" 
                  value={settings.rate}
                  onChange={(e) => setSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Pitch ({settings.pitch})</label>
                <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={settings.pitch}
                  onChange={(e) => setSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            <label className="flex items-center gap-4 cursor-pointer p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={settings.autoSpeak}
                  onChange={() => setSettings(prev => ({ ...prev, autoSpeak: !prev.autoSpeak }))}
                />
                <div className={`block w-12 h-7 rounded-full transition-colors ${settings.autoSpeak ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${settings.autoSpeak ? 'translate-x-5' : ''}`}></div>
              </div>
              <span className="text-sm font-black text-gray-700">Auto-speak</span>
            </label>
          </section>

          <DataSection settings={settings} />
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 py-5 rounded-[1.5rem] bg-indigo-600 text-white font-black tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase"
        >
          Confirm Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
