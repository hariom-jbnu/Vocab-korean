import { useEffect, useState } from 'react';
import { loadJson, saveJson } from '../lib/storage';

/** useState that is saved to localStorage and restored on the next visit. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, initial));

  useEffect(() => {
    saveJson(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
