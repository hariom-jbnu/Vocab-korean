import { useEffect, useState } from 'react';
import type { VocabItem } from '../types';

/** The word list, loaded after the first paint. Empty until it arrives. */
export function useVocab(): { words: VocabItem[]; failed: boolean } {
  const [words, setWords] = useState<VocabItem[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    import('../lib/planData')
      .then((m) => alive && setWords(m.PLAN_WORDS))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  return { words, failed };
}
