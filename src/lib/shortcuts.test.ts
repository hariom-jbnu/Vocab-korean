import { describe, expect, it } from 'vitest';
import { BINDINGS, keyLabel, keyOwners, readShortcut, SHORTCUT_GROUPS } from './shortcuts';

const key = (code: string, extra: Partial<KeyboardEvent> & { isComposing?: boolean } = {}) => ({
  code,
  key: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});

describe('BINDINGS', () => {
  it('gives every key press exactly one meaning', () => {
    const clashes = [...keyOwners()].filter(([, owners]) => owners.length > 1).map(([sig]) => sig);
    expect(clashes).toEqual([]);
  });

  it('never uses Esc, G or bare F for a study action', () => {
    expect(readShortcut(key('Escape'))).toBeNull();
    expect(readShortcut(key('KeyG'))).toBeNull();
    expect(readShortcut(key('KeyF'))).toEqual({ type: 'answer', n: 4 });
  });
});

describe('readShortcut', () => {
  it('shows choices, goes on, and says "I don\'t know"', () => {
    expect(readShortcut(key('Space'))).toEqual({ type: 'primary' });
    expect(readShortcut(key('Enter'))).toEqual({ type: 'primary' });
    expect(readShortcut(key('KeyX'))).toEqual({ type: 'dontKnow' });
    expect(readShortcut(key('Backspace'))).toEqual({ type: 'dontKnow' });
  });

  it('answers with the number keys or the home row, and N or 5 for "Not in the list"', () => {
    expect(readShortcut(key('Digit1'))).toEqual({ type: 'answer', n: 1 });
    expect(readShortcut(key('KeyS'))).toEqual({ type: 'answer', n: 2 });
    expect(readShortcut(key('Numpad3'))).toEqual({ type: 'answer', n: 3 });
    expect(readShortcut(key('KeyN'))).toEqual({ type: 'notInList' });
    expect(readShortcut(key('Digit5'))).toEqual({ type: 'notInList' });
  });

  it('undoes with Z, U or Ctrl+Z, and copies with C', () => {
    expect(readShortcut(key('KeyZ'))).toEqual({ type: 'undo' });
    expect(readShortcut(key('KeyU'))).toEqual({ type: 'undo' });
    expect(readShortcut(key('KeyZ', { ctrlKey: true }))).toEqual({ type: 'undo' });
    expect(readShortcut(key('KeyC'))).toEqual({ type: 'copy' });
  });

  it('plays the word and each sentence from J K L, also with the Korean layout on', () => {
    expect(readShortcut(key('KeyJ', { key: 'ㅓ' }))).toEqual({ type: 'speak' });
    expect(readShortcut(key('KeyR'))).toEqual({ type: 'speak' });
    expect(readShortcut(key('KeyK'))).toEqual({ type: 'example', n: 1 });
    expect(readShortcut(key('KeyL'))).toEqual({ type: 'example', n: 2 });
  });

  it('uses Shift for the Browse keys that look like study keys', () => {
    expect(readShortcut(key('KeyF', { shiftKey: true }))).toEqual({ type: 'fullscreen' });
    expect(readShortcut(key('F11'))).toEqual({ type: 'fullscreen' });
    expect(readShortcut(key('Digit2', { shiftKey: true }))).toEqual({ type: 'toggle', n: 2 });
    expect(readShortcut(key('KeyC', { shiftKey: true }))).toEqual({ type: 'color' });
    expect(readShortcut(key('Slash'))).toEqual({ type: 'jump' });
    expect(readShortcut(key('Home'))).toEqual({ type: 'first' });
    expect(readShortcut(key('ArrowRight'))).toEqual({ type: 'next' });
  });

  it('goes to pages with Alt + a number, and opens the list with ?', () => {
    expect(readShortcut(key('Digit1', { altKey: true }))).toEqual({ type: 'go', to: '/' });
    expect(readShortcut(key('Digit2', { altKey: true }))).toEqual({ type: 'go', to: '/plan' });
    expect(readShortcut(key('Digit3', { altKey: true }))).toEqual({ type: 'go', to: '/stats' });
    expect(readShortcut(key('Digit4', { altKey: true }))).toEqual({ type: 'go', to: '/browse' });
    expect(readShortcut(key('Digit5', { altKey: true }))).toEqual({ type: 'settings' });
    expect(readShortcut(key('Slash', { shiftKey: true, key: '?' }))).toEqual({ type: 'help' });
    // The old single-letter page keys are free again.
    expect(readShortcut(key('KeyH'))).toBeNull();
    expect(readShortcut(key('KeyB'))).toBeNull();
  });

  it('leaves browser shortcuts alone and waits for Korean typing to finish', () => {
    expect(readShortcut(key('KeyR', { ctrlKey: true }))).toBeNull();
    expect(readShortcut(key('KeyC', { ctrlKey: true }))).toBeNull();
    expect(readShortcut(key('KeyV', { ctrlKey: true }))).toBeNull();
    expect(readShortcut(key('KeyJ', { metaKey: true }))).toBeNull();
    expect(readShortcut(key('KeyA', { altKey: true }))).toBeNull();
    expect(readShortcut(key('Space', { isComposing: true }))).toBeNull();
  });
});

describe('the shortcut sheet', () => {
  const lines = SHORTCUT_GROUPS.flatMap((g) => g.items);

  it('is built from the same list the handler reads', () => {
    const shown = new Set(lines.flatMap((l) => l.keys.flat()));
    for (const b of BINDINGS) for (const k of b.keys) if (!k.hidden) expect(shown).toContain(k.label);
  });

  it('shows 1 2 3 4 or A S D F on one line', () => {
    const answer = lines.find((l) => l.label.startsWith('Pick choice'))!;
    expect(answer.keys).toEqual([
      ['1', '2', '3', '4'],
      ['A', 'S', 'D', 'F'],
    ]);
  });

  it('labels buttons with the first key of each action', () => {
    expect(keyLabel('dontKnow')).toBe('X');
    expect(keyLabel('settings')).toBe('Alt+5');
    expect(keyLabel('fullscreen')).toBe('F11');
  });
});
