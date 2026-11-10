import { beforeEach, describe, expect, it } from 'vitest';
import { loadJson, saveJson } from './storage';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('storage', () => {
  it('round-trips values', () => {
    saveJson('n', 5);
    expect(loadJson('n', 0)).toBe(5);
  });

  it('fills fields added after the value was saved', () => {
    saveJson('settings', { rate: 1.2 });
    expect(loadJson('settings', { rate: 0.8, pitch: 1 })).toEqual({ rate: 1.2, pitch: 1 });
  });

  it('falls back on bad JSON or a wrong type', () => {
    localStorage.setItem('vocab:bad', '{nope');
    expect(loadJson('bad', 3)).toBe(3);
    saveJson('num', 'text');
    expect(loadJson('num', 7)).toBe(7);
  });

  it('falls back when storage throws', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(() => saveJson('x', 1)).not.toThrow();
    expect(loadJson('x', 2)).toBe(2);
  });
});
