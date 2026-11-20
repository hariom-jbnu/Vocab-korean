/**
 * Keyboard shortcuts, read from the physical key (KeyboardEvent.code) so they
 * work the same with a Korean keyboard layout turned on: the J key is J even
 * when it types ㅓ.
 *
 * The layout keeps both hands on the home row: A S D F (or 1 2 3 4) answer,
 * J K L play the word and its two sentences, and the thumb presses Space.
 */
export type Page = '/' | '/plan' | '/stats' | '/browse';

export type Shortcut =
  | { type: 'primary' }
  | { type: 'answer'; n: 1 | 2 | 3 | 4 }
  | { type: 'speak' }
  | { type: 'example'; n: 1 | 2 }
  | { type: 'undo' }
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'fullscreen' }
  | { type: 'go'; to: Page }
  | { type: 'settings' }
  | { type: 'help' };

type KeyInfo = Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & { isComposing?: boolean };

const ANSWER_CODES: Record<string, 1 | 2 | 3 | 4> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
  KeyA: 1,
  KeyS: 2,
  KeyD: 3,
  KeyF: 4,
};

const PAGE_CODES: Record<string, Page> = {
  KeyH: '/',
  KeyP: '/plan',
  KeyG: '/stats',
  KeyB: '/browse',
};

/** The shortcut a key press stands for, or null. */
export function readShortcut(e: KeyInfo): Shortcut | null {
  if (e.isComposing || e.metaKey || e.altKey) return null;
  if (e.ctrlKey) return e.code === 'KeyZ' && !e.shiftKey ? { type: 'undo' } : null;
  if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) return { type: 'help' };
  if (e.shiftKey) return null;

  switch (e.code) {
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
      return { type: 'primary' };
    case 'KeyJ':
    case 'KeyR':
      return { type: 'speak' };
    case 'KeyK':
      return { type: 'example', n: 1 };
    case 'KeyL':
      return { type: 'example', n: 2 };
    case 'KeyU':
      return { type: 'undo' };
    case 'ArrowLeft':
      return { type: 'prev' };
    case 'ArrowRight':
      return { type: 'next' };
    case 'Comma':
      return { type: 'settings' };
  }
  if (e.code in ANSWER_CODES) return { type: 'answer', n: ANSWER_CODES[e.code] };
  if (e.code in PAGE_CODES) return { type: 'go', to: PAGE_CODES[e.code] };
  // F is an answer key in study; Browse reads it as full screen (see below).
  return null;
}

/** In Browse, F toggles full screen instead of answering. */
export function isFullscreenKey(e: KeyInfo): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.code === 'KeyF';
}

/** True while the learner types in a field, where keys must reach the field. */
export function isTypingTarget(el: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== 'undefined' &&
    el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  );
}

/** True while a dialog (settings, the shortcut list) covers the page. */
export function modalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
}

/** The list shown on the "Keyboard shortcuts" sheet. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: 'Study',
    items: [
      { keys: ['Space', 'Enter'], label: 'Show answer, continue, next card' },
      { keys: ['A', 'S', 'D', 'F'], label: 'Pick choice 1–4, or Again / Hard / Good / Easy' },
      { keys: ['1', '2', '3', '4'], label: 'Same as A S D F' },
      { keys: ['Esc'], label: "Typing round: I don't know" },
      { keys: ['U'], label: 'Undo the last answer' },
    ],
  },
  {
    title: 'Listen',
    items: [
      { keys: ['J', 'R'], label: 'Play the word again' },
      { keys: ['K'], label: 'Play example sentence 1' },
      { keys: ['L'], label: 'Play example sentence 2' },
    ],
  },
  {
    title: 'Browse',
    items: [
      { keys: ['←', '→'], label: 'Previous / next word (Space also goes next)' },
      { keys: ['F'], label: 'Full screen on or off' },
    ],
  },
  {
    title: 'Go to',
    items: [
      { keys: ['H'], label: 'Review (home)' },
      { keys: ['P'], label: 'Plan' },
      { keys: ['G'], label: 'Stats (graphs)' },
      { keys: ['B'], label: 'Browse' },
      { keys: [','], label: 'Settings' },
      { keys: ['?'], label: 'This list' },
    ],
  },
];
