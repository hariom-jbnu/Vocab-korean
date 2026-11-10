/**
 * Small, safe wrappers around localStorage.
 *
 * Storage can be unavailable (private mode, blocked site data) or hold data
 * from an older version of the app, so every read falls back to a default
 * and every write fails quietly.
 */
const PREFIX = 'vocab:';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw) as unknown;
    if (isPlainObject(fallback) && isPlainObject(value)) {
      // Fill in fields added since the value was saved.
      return { ...fallback, ...value } as T;
    }
    return typeof value === typeof fallback ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: keep working in memory.
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
