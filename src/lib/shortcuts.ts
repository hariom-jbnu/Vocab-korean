/**
 * Every keyboard shortcut in the app, in one list. The key handler and the
 * "Keyboard shortcuts" sheet both read BINDINGS, so the sheet always shows
 * the keys that really work, and a test checks that no key means two things.
 *
 * Keys are read by their physical position (KeyboardEvent.code), so they
 * work the same with the Korean keyboard layout on: the J key is J even when
 * it types ㅓ.
 */
export type Page = '/' | '/plan' | '/stats' | '/browse';

export type Shortcut =
  | { type: 'primary' }
  | { type: 'dontKnow' }
  | { type: 'answer'; n: 1 | 2 | 3 | 4 }
  | { type: 'notInList' }
  | { type: 'undo' }
  | { type: 'copy' }
  | { type: 'speak' }
  | { type: 'example'; n: 1 | 2 }
  | { type: 'prev' }
  | { type: 'next' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'jump' }
  | { type: 'toggle'; n: 1 | 2 | 3 | 4 }
  | { type: 'shuffle' }
  | { type: 'autoplay' }
  | { type: 'color' }
  | { type: 'fullscreen' }
  | { type: 'go'; to: Page }
  | { type: 'settings' }
  | { type: 'help' };

/** One key press: the physical key plus the modifiers that must be held. */
export interface KeySpec {
  code: string;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  /** How the key is written on the shortcut sheet. */
  label: string;
  /** Works, but is left off the sheet (keypad copies of the number keys). */
  hidden?: boolean;
}

export interface Binding {
  /** What the keys do; null for keys handled elsewhere (Esc closes dialogs). */
  shortcut: Shortcut | null;
  keys: KeySpec[];
  /** Sheet section. */
  group: 'Study & recall' | 'Listen' | 'Browse & view' | 'Go to';
  /** Sheet line; bindings with the same label share a line (1, 2, 3, 4). */
  label: string;
}

const k = (code: string, label: string, mods: Partial<Omit<KeySpec, 'code' | 'label'>> = {}): KeySpec => ({ code, label, ...mods });

const STUDY = 'Study & recall' as const;
const LISTEN = 'Listen' as const;
const BROWSE = 'Browse & view' as const;
const GO = 'Go to' as const;

const ANSWER_LABEL = 'Pick choice 1–4, or rate Again / Hard / Good / Easy';
const TOGGLE_LABEL = 'Show or hide Korean / English / Hindi / sentences';
const PREV_NEXT_LABEL = 'Previous / next word (Space also goes next)';
const FIRST_LAST_LABEL = 'First / last word';

export const BINDINGS: readonly Binding[] = [
  // Study & recall: left hand on A S D F, thumb on Space.
  {
    shortcut: { type: 'primary' },
    keys: [k('Space', 'Space'), k('Enter', 'Enter'), k('NumpadEnter', 'Enter', { hidden: true })],
    group: STUDY,
    label: 'Show choices, show the answer, next card',
  },
  {
    shortcut: { type: 'dontKnow' },
    keys: [k('KeyX', 'X'), k('Backspace', 'Backspace')],
    group: STUDY,
    label: "I don't know: show the answer, mark Again",
  },
  ...([1, 2, 3, 4] as const).map(
    (n): Binding => ({
      shortcut: { type: 'answer', n },
      keys: [
        k(`Digit${n}`, String(n)),
        k(['KeyA', 'KeyS', 'KeyD', 'KeyF'][n - 1], 'ASDF'[n - 1]),
        k(`Numpad${n}`, String(n), { hidden: true }),
      ],
      group: STUDY,
      label: ANSWER_LABEL,
    })
  ),
  {
    shortcut: { type: 'notInList' },
    keys: [k('Digit5', '5'), k('KeyN', 'N'), k('Numpad5', '5', { hidden: true })],
    group: STUDY,
    label: 'Not in the list',
  },
  {
    shortcut: { type: 'undo' },
    keys: [k('KeyZ', 'Z'), k('KeyU', 'U'), k('KeyZ', 'Ctrl+Z', { ctrl: true, hidden: true })],
    group: STUDY,
    label: 'Undo the last answer',
  },
  { shortcut: { type: 'copy' }, keys: [k('KeyC', 'C')], group: STUDY, label: 'Copy the card text' },

  // Listen: right hand on J K L.
  { shortcut: { type: 'speak' }, keys: [k('KeyJ', 'J'), k('KeyR', 'R')], group: LISTEN, label: 'Play the word' },
  { shortcut: { type: 'example', n: 1 }, keys: [k('KeyK', 'K')], group: LISTEN, label: 'Play example sentence 1' },
  { shortcut: { type: 'example', n: 2 }, keys: [k('KeyL', 'L')], group: LISTEN, label: 'Play example sentence 2' },

  // Browse & view.
  { shortcut: { type: 'prev' }, keys: [k('ArrowLeft', '←')], group: BROWSE, label: PREV_NEXT_LABEL },
  { shortcut: { type: 'next' }, keys: [k('ArrowRight', '→')], group: BROWSE, label: PREV_NEXT_LABEL },
  { shortcut: { type: 'first' }, keys: [k('Home', 'Home')], group: BROWSE, label: FIRST_LAST_LABEL },
  { shortcut: { type: 'last' }, keys: [k('End', 'End')], group: BROWSE, label: FIRST_LAST_LABEL },
  { shortcut: { type: 'jump' }, keys: [k('Slash', '/')], group: BROWSE, label: 'Go to a word number' },
  ...([1, 2, 3, 4] as const).map(
    (n): Binding => ({
      shortcut: { type: 'toggle', n },
      keys: [k(`Digit${n}`, `Shift+${n}`, { shift: true })],
      group: BROWSE,
      label: TOGGLE_LABEL,
    })
  ),
  { shortcut: { type: 'shuffle' }, keys: [k('KeyM', 'M')], group: BROWSE, label: 'Shuffle (random order) on or off' },
  { shortcut: { type: 'autoplay' }, keys: [k('KeyV', 'V')], group: BROWSE, label: 'Auto-play each word on or off' },
  { shortcut: { type: 'color' }, keys: [k('KeyC', 'Shift+C', { shift: true })], group: BROWSE, label: 'Next card color' },
  {
    shortcut: { type: 'fullscreen' },
    keys: [k('F11', 'F11'), k('KeyF', 'Shift+F', { shift: true })],
    group: BROWSE,
    label: 'Full screen on or off',
  },
  { shortcut: null, keys: [k('Escape', 'Esc')], group: BROWSE, label: 'Close a dialog, leave full screen' },

  // Go to: Alt + a number, so no letter is taken away from study.
  { shortcut: { type: 'go', to: '/' }, keys: [k('Digit1', 'Alt+1', { alt: true })], group: GO, label: 'Review' },
  { shortcut: { type: 'go', to: '/plan' }, keys: [k('Digit2', 'Alt+2', { alt: true })], group: GO, label: 'Plan' },
  { shortcut: { type: 'go', to: '/stats' }, keys: [k('Digit3', 'Alt+3', { alt: true })], group: GO, label: 'Stats' },
  { shortcut: { type: 'go', to: '/browse' }, keys: [k('Digit4', 'Alt+4', { alt: true })], group: GO, label: 'Browse' },
  { shortcut: { type: 'settings' }, keys: [k('Digit5', 'Alt+5', { alt: true })], group: GO, label: 'Settings' },
  { shortcut: { type: 'help' }, keys: [k('Slash', '?', { shift: true })], group: GO, label: 'This list of shortcuts' },
];

/** A key press written as one string, e.g. "S+Digit1" (Shift+1) or "A+Digit3" (Alt+3). */
const signature = (code: string, { ctrl = false, alt = false, shift = false }: { ctrl?: boolean; alt?: boolean; shift?: boolean }) =>
  `${ctrl ? 'C+' : ''}${alt ? 'A+' : ''}${shift ? 'S+' : ''}${code}`;

/** Every key press the app knows, with the bindings that claim it (a test checks there is exactly one). */
export function keyOwners(): Map<string, Binding[]> {
  const owners = new Map<string, Binding[]>();
  for (const b of BINDINGS) {
    for (const key of b.keys) {
      const sig = signature(key.code, key);
      owners.set(sig, [...(owners.get(sig) ?? []), b]);
    }
  }
  return owners;
}

const LOOKUP = new Map<string, Shortcut | null>([...keyOwners()].map(([sig, owners]) => [sig, owners[0].shortcut]));

type KeyInfo = Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & { isComposing?: boolean };

/** The shortcut a key press stands for, or null. */
export function readShortcut(e: KeyInfo): Shortcut | null {
  if (e.isComposing || e.metaKey) return null;
  const hit = LOOKUP.get(signature(e.code, { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }));
  if (hit !== undefined) return hit;
  // Keyboard layouts where ? is not Shift + the / key.
  if (e.key === '?' && !e.ctrlKey && !e.altKey) return { type: 'help' };
  return null;
}

/** True while the learner types in a field, where keys must reach the field. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('[contenteditable]') !== null;
}

/** True while a dialog (settings, the shortcut list) covers the page. */
export function modalOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null;
}

/** The first key shown for a shortcut, for buttons and hints ("X", "Alt+5"). */
export function keyLabel(type: Shortcut['type']): string {
  const b = BINDINGS.find((x) => x.shortcut?.type === type);
  return b?.keys.find((key) => !key.hidden)?.label ?? '';
}

export interface ShortcutLine {
  label: string;
  /** Alternatives, shown with "or" between them: [["1","2","3","4"], ["A","S","D","F"]]. */
  keys: string[][];
}

/** The "Keyboard shortcuts" sheet, built from BINDINGS. */
export function shortcutGroups(): { title: Binding['group']; items: ShortcutLine[] }[] {
  const groups: { title: Binding['group']; lines: { label: string; bindings: Binding[] }[] }[] = [];
  for (const b of BINDINGS) {
    let group = groups.find((g) => g.title === b.group);
    if (!group) groups.push((group = { title: b.group, lines: [] }));
    let line = group.lines.find((l) => l.label === b.label);
    if (!line) group.lines.push((line = { label: b.label, bindings: [] }));
    line.bindings.push(b);
  }
  return groups.map((g) => ({
    title: g.title,
    items: g.lines.map(({ label, bindings }) => {
      // Key i of every binding on a line is one alternative: 1 2 3 4, then A S D F.
      const shown = bindings.map((b) => b.keys.filter((key) => !key.hidden).map((key) => key.label));
      const width = Math.max(...shown.map((s) => s.length));
      const keys = Array.from({ length: width }, (_, i) => shown.map((s) => s.at(i)).filter((x): x is string => !!x));
      return { label, keys };
    }),
  }));
}

/** The sheet, ready to render. */
export const SHORTCUT_GROUPS = shortcutGroups();
