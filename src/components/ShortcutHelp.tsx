import React, { useEffect, useRef } from 'react';
import { SHORTCUT_GROUPS } from '../lib/shortcuts';

const OPEN_EVENT = 'vocab:shortcuts';

/** Open the shortcut list from anywhere (the app listens for this). */
export function openShortcutList(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** Call back when something asks for the shortcut list. */
export function onShortcutListRequest(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

/** A sheet listing every keyboard shortcut. Esc, ? or a click outside closes it. */
const ShortcutHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-gray-900 rounded-[2rem] shadow-2xl w-full max-w-2xl p-6 md:p-8 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <i className="bi bi-x-lg"></i>
        </button>
        <h2 id="shortcut-title" className="text-2xl font-black tracking-tight mb-1">
          Keyboard shortcuts
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Left hand on <b>A S D F</b> to answer, right hand on <b>J K L</b> to listen, thumb on <b>Space</b> to go on. Keys work with
          the Korean keyboard on too.
        </p>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{group.title}</h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-700">{item.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-7 h-7 px-1.5 rounded-lg bg-gray-100 border border-black/10 border-b-2 text-xs font-black text-gray-800 flex items-center justify-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelp;
