import { useEffect, useRef } from 'react';
import { isTypingTarget, modalOpen, readShortcut, type Shortcut } from '../lib/shortcuts';

/**
 * Listen for keyboard shortcuts. The handler returns true when it used the
 * key; the key's default (scrolling, pressing a focused button) is then
 * stopped and later listeners skip it. Each part of the page handles its own
 * keys (the quiz card its answers, the sentences K and L, the app the page
 * keys), so the order listeners run in does not matter.
 *
 * Keys are ignored while typing in a field or while a dialog is open.
 */
export function useShortcuts(handler: (shortcut: Shortcut, e: KeyboardEvent) => boolean | void, enabled = true): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || modalOpen()) return;
      const shortcut = readShortcut(e);
      if (!shortcut) return;
      // Holding a key down must not race through cards; arrows may repeat.
      if (e.repeat && shortcut.type !== 'prev' && shortcut.type !== 'next') {
        e.preventDefault();
        return;
      }
      if (latest.current(shortcut, e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
