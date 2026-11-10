import React, { useRef, useState } from 'react';
import type { Settings } from '../types';
import { clearProgress, getAllCards, getAllReviews, replaceProgress } from '../lib/db';
import { backupFileName, createBackup, parseBackup } from '../lib/backup';
import { saveJson } from '../lib/storage';
import { useCloud } from '../hooks/useCloud';

/** Download, restore or reset learning progress. */
const DataSection: React.FC<{ settings: Settings }> = ({ settings }) => {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cloud = useCloud();
  const signedIn = !!cloud.user;

  const download = async () => {
    try {
      const [cards, reviews] = await Promise.all([getAllCards(), getAllReviews()]);
      const blob = new Blob([JSON.stringify(createBackup(cards.values(), reviews, settings))], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFileName();
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: `Saved ${cards.size} words and ${reviews.length} answers.` });
    } catch {
      setMessage({ text: 'Could not read your progress in this browser.', error: true });
    }
  };

  const restore = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      const ok = window.confirm(
        `Replace your current progress with this backup${signedIn ? ' on all your devices' : ''}?\n\n${backup.cards.length} words and ${backup.reviews.length} answers will be restored.`
      );
      if (!ok) return;
      // Signed in: clear the account first so other devices take the backup too.
      if (signedIn) await cloud.resetEverywhere();
      await replaceProgress(backup.cards, backup.reviews);
      if (backup.settings) saveJson('settings', { ...settings, ...backup.settings });
      window.location.reload();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not restore this file.', error: true });
    }
  };

  const reset = async () => {
    const where = signedIn ? 'in your account and on all your devices' : 'in this browser';
    if (!window.confirm(`Delete all learning progress ${where}? Download a backup first if you may want it back.`)) return;
    try {
      if (signedIn) await cloud.resetEverywhere();
      await clearProgress();
      window.location.reload();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not reset your progress. Check your connection.', error: true });
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your Data</h3>
      <p className="text-[11px] text-gray-400">
        {signedIn
          ? 'Progress is saved in this browser and in your account. A backup file is a copy you keep yourself.'
          : 'Progress is saved only in this browser. Download a backup to keep it safe or move it to another device.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={download} className="py-3 rounded-2xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black">
          <i className="bi bi-download mr-1.5"></i>Backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-widest hover:bg-gray-200"
        >
          <i className="bi bi-upload mr-1.5"></i>Restore
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) restore(file);
        }}
      />
      {message && (
        <p role="status" className={`text-[11px] font-bold ${message.error ? 'text-rose-600' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      )}
      <button onClick={reset} className="text-[11px] font-bold text-rose-600 underline hover:text-rose-700">
        Reset all progress
      </button>
    </section>
  );
};

export default DataSection;
