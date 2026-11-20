import { describe, expect, it } from 'vitest';
import { isFullscreenKey, numberKey, readShortcut, SHORTCUT_GROUPS } from './shortcuts';

const key = (code: string, extra: Partial<KeyboardEvent> & { isComposing?: boolean } = {}) => ({
  code,
  key: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});

describe('readShortcut', () => {
  it('answers with the home row or the number keys', () => {
    expect(readShortcut(key('KeyA'))).toEqual({ type: 'answer', n: 1 });
    expect(readShortcut(key('KeyF'))).toEqual({ type: 'answer', n: 4 });
    expect(readShortcut(key('Digit3'))).toEqual({ type: 'answer', n: 3 });
    expect(readShortcut(key('Numpad2'))).toEqual({ type: 'answer', n: 2 });
  });

  it('plays the word and each sentence from J K L', () => {
    expect(readShortcut(key('KeyJ'))).toEqual({ type: 'speak' });
    expect(readShortcut(key('KeyR'))).toEqual({ type: 'speak' });
    expect(readShortcut(key('KeyK'))).toEqual({ type: 'example', n: 1 });
    expect(readShortcut(key('KeyL'))).toEqual({ type: 'example', n: 2 });
  });

  it('reads the physical key, so a Korean layout gives the same result', () => {
    // With the Korean layout on, the J key types ㅓ.
    expect(readShortcut(key('KeyJ', { key: 'ㅓ' }))).toEqual({ type: 'speak' });
  });

  it('goes on with Space or Enter, undoes with U or Ctrl+Z', () => {
    expect(readShortcut(key('Space', { key: ' ' }))).toEqual({ type: 'primary' });
    expect(readShortcut(key('Enter', { key: 'Enter' }))).toEqual({ type: 'primary' });
    expect(readShortcut(key('KeyU'))).toEqual({ type: 'undo' });
    expect(readShortcut(key('KeyZ', { ctrlKey: true }))).toEqual({ type: 'undo' });
  });

  it('opens pages, settings and the shortcut list', () => {
    expect(readShortcut(key('KeyH'))).toEqual({ type: 'go', to: '/' });
    expect(readShortcut(key('KeyP'))).toEqual({ type: 'go', to: '/plan' });
    expect(readShortcut(key('KeyG'))).toEqual({ type: 'go', to: '/stats' });
    expect(readShortcut(key('KeyB'))).toEqual({ type: 'go', to: '/browse' });
    expect(readShortcut(key('Comma'))).toEqual({ type: 'settings' });
    expect(readShortcut(key('Slash', { key: '?', shiftKey: true }))).toEqual({ type: 'help' });
  });

  it('has a key for every Browse button', () => {
    expect(readShortcut(key('Home'))).toEqual({ type: 'first' });
    expect(readShortcut(key('End'))).toEqual({ type: 'last' });
    expect(readShortcut(key('KeyN'))).toEqual({ type: 'jump' });
    expect(readShortcut(key('KeyM'))).toEqual({ type: 'shuffle' });
    expect(readShortcut(key('KeyV'))).toEqual({ type: 'autoplay' });
    expect(readShortcut(key('KeyC'))).toEqual({ type: 'color' });
  });

  it('leaves browser and system shortcuts alone, and waits for Korean typing to finish', () => {
    expect(readShortcut(key('KeyR', { ctrlKey: true }))).toBeNull();
    expect(readShortcut(key('KeyC', { ctrlKey: true }))).toBeNull(); // copy
    expect(readShortcut(key('KeyV', { ctrlKey: true }))).toBeNull(); // paste
    expect(readShortcut(key('KeyJ', { metaKey: true }))).toBeNull();
    expect(readShortcut(key('KeyA', { altKey: true }))).toBeNull();
    expect(readShortcut(key('KeyA', { shiftKey: true }))).toBeNull();
    expect(readShortcut(key('Space', { isComposing: true }))).toBeNull();
    expect(readShortcut(key('KeyQ'))).toBeNull();
  });

  it('never gives one key two meanings', () => {
    const codes = [
      'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyR', 'KeyK', 'KeyL', 'KeyU', 'KeyH', 'KeyP', 'KeyG', 'KeyB', 'Comma', 'Space',
      'KeyN', 'KeyM', 'KeyV', 'KeyC', 'Home', 'End',
    ];
    const types = codes.map((c) => JSON.stringify(readShortcut(key(c))));
    expect(new Set(types).size).toBe(codes.length - 1); // J and R both play the word
  });
});

describe('isFullscreenKey', () => {
  it('is F alone', () => {
    expect(isFullscreenKey(key('KeyF'))).toBe(true);
    expect(isFullscreenKey(key('KeyF', { ctrlKey: true }))).toBe(false);
  });
});

describe('numberKey', () => {
  it('is the number row or keypad 1 to 4, not A S D F', () => {
    expect(numberKey(key('Digit1'))).toBe(1);
    expect(numberKey(key('Numpad4'))).toBe(4);
    expect(numberKey(key('Digit5'))).toBeNull();
    expect(numberKey(key('KeyA'))).toBeNull();
  });
});

describe('SHORTCUT_GROUPS', () => {
  it('lists the listening keys', () => {
    const labels = SHORTCUT_GROUPS.flatMap((g) => g.items.map((i) => i.keys.join(' ')));
    expect(labels).toContain('K');
    expect(labels).toContain('L');
  });

  it('lists every Browse key', () => {
    const browse = SHORTCUT_GROUPS.find((g) => g.title === 'Browse')!.items.flatMap((i) => i.keys);
    for (const k of ['←', '→', 'Home', 'End', 'N', '1', '4', 'M', 'V', 'C', 'F']) expect(browse).toContain(k);
  });
});
