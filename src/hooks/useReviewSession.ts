import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VocabItem } from '../types';
import { getAllCards, getReviewsSince, saveAnswer, undoAnswer } from '../lib/db';
import { buildDailyQueue, pickNext, seededShuffle } from '../lib/queue';
import { endOfStudyDay, startOfStudyDay } from '../lib/day';
import { createScheduler, newCard, previewDue, rate, Rating, State, type Grade, type WordCard } from '../lib/srs';

interface UndoEntry {
  wordId: string;
  previous: WordCard | undefined;
  recordId: number | null;
  queue: string[];
  learning: Map<string, Date>;
  wasNew: boolean;
  grade: Grade;
}

export interface SessionStats {
  answered: number;
  newLearned: number;
  again: number;
}

interface Options {
  newPerDay: number;
  retention: number;
  seed: number;
}

const isLearning = (c: WordCard) => c.state === State.Learning || c.state === State.Relearning;

/**
 * Runs one study session: loads saved cards, builds today's queue, applies
 * answers through FSRS and saves each one before moving on.
 */
export function useReviewSession(words: readonly VocabItem[], { newPerDay, retention, seed }: Options) {
  const scheduler = useMemo(() => createScheduler(retention), [retention]);
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const wordsById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);

  const cards = useRef(new Map<string, WordCard>());
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<string[]>([]);
  const [learning, setLearning] = useState<Map<string, Date>>(new Map());
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [stats, setStats] = useState<SessionStats>({ answered: 0, newLearned: 0, again: 0 });
  const [storageError, setStorageError] = useState(false);
  const [newDoneToday, setNewDoneToday] = useState(0);
  const busy = useRef(false);

  const show = useCallback((id: string | undefined) => {
    setCurrentId(id);
    setRevealed(false);
    setShownAt(Date.now());
  }, []);

  // Load saved progress and build today's queue.
  useEffect(() => {
    if (wordIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      let saved = new Map<string, WordCard>();
      let today: Awaited<ReturnType<typeof getReviewsSince>> = [];
      try {
        [saved, today] = await Promise.all([getAllCards(), getReviewsSince(startOfStudyDay(now))]);
      } catch {
        setStorageError(true);
      }
      if (cancelled) return;

      cards.current = saved;
      const daily = buildDailyQueue(wordIds, saved, today, now, { newPerDay, seed });
      const dayEnd = endOfStudyDay(now).getTime();
      const learningNow = new Map<string, Date>();
      const main: string[] = [];
      for (const id of daily.reviews) {
        const card = saved.get(id)!;
        if (isLearning(card) && card.due.getTime() < dayEnd) learningNow.set(id, card.due);
        else main.push(id);
      }
      main.push(...daily.newWords);

      setNewDoneToday(daily.newDoneToday);
      setQueue(main);
      setLearning(learningNow);
      setUndoStack([]);
      show(pickNext(main, learningNow, now));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Rebuild only when the word list or the daily limit changes; the seed is fixed per learner.
  }, [wordIds, newPerDay]);

  const currentCard = currentId ? cards.current.get(currentId) : undefined;
  const isNew = !!currentId && (!currentCard || currentCard.state === State.New);

  const previews = useMemo(() => {
    if (!currentId) return null;
    const card = cards.current.get(currentId) ?? newCard(currentId, new Date());
    return previewDue(scheduler, card, new Date());
    // shownAt changes whenever a card is shown, so previews refresh per card.
  }, [currentId, scheduler, shownAt]);

  const reveal = useCallback(() => setRevealed(true), []);

  const answer = useCallback(
    async (grade: Grade, durationMs?: number) => {
      if (!currentId || busy.current) return;
      busy.current = true;
      try {
        const now = new Date();
        const previous = cards.current.get(currentId);
        const wasNew = !previous || previous.state === State.New;
        const { card, record } = rate(
          scheduler,
          previous ?? newCard(currentId, now),
          grade,
          now,
          durationMs ?? now.getTime() - shownAt
        );

        let recordId: number | null = null;
        try {
          recordId = await saveAnswer(card, record);
        } catch {
          setStorageError(true);
        }

        cards.current.set(currentId, card);
        const nextQueue = queue.filter((id) => id !== currentId);
        const nextLearning = new Map(learning);
        nextLearning.delete(currentId);
        if (isLearning(card) && card.due.getTime() < endOfStudyDay(now).getTime()) {
          nextLearning.set(currentId, card.due);
        }

        setUndoStack((s) => [...s.slice(-49), { wordId: currentId, previous, recordId, queue, learning, wasNew, grade }]);
        setStats((s) => ({
          answered: s.answered + 1,
          newLearned: s.newLearned + (wasNew ? 1 : 0),
          again: s.again + (grade === Rating.Again ? 1 : 0),
        }));
        if (wasNew) setNewDoneToday((n) => n + 1);
        setQueue(nextQueue);
        setLearning(nextLearning);
        show(pickNext(nextQueue, nextLearning, now));
      } finally {
        busy.current = false;
      }
    },
    [currentId, scheduler, shownAt, queue, learning, show]
  );

  const undo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last || busy.current) return;
    busy.current = true;
    try {
      if (last.recordId !== null) {
        try {
          await undoAnswer(last.previous, last.wordId, last.recordId);
        } catch {
          setStorageError(true);
        }
      }
      if (last.previous) cards.current.set(last.wordId, last.previous);
      else cards.current.delete(last.wordId);
      setUndoStack((s) => s.slice(0, -1));
      setStats((s) => ({
        answered: s.answered - 1,
        newLearned: s.newLearned - (last.wasNew ? 1 : 0),
        again: s.again - (last.grade === Rating.Again ? 1 : 0),
      }));
      if (last.wasNew) setNewDoneToday((n) => n - 1);
      setQueue(last.queue);
      setLearning(last.learning);
      show(last.wordId);
    } finally {
      busy.current = false;
    }
  }, [undoStack, show]);

  /** Add more new words to today's session beyond the daily limit. */
  const learnMore = useCallback(
    (count: number) => {
      const inSession = new Set([...queue, ...learning.keys()]);
      const unseen = wordIds.filter((id) => {
        const c = cards.current.get(id);
        return (!c || c.state === State.New) && !inSession.has(id);
      });
      const extra = seededShuffle(unseen, seed).slice(0, count);
      if (extra.length === 0) return;
      const nextQueue = [...queue, ...extra];
      setQueue(nextQueue);
      show(pickNext(nextQueue, learning, new Date()));
    },
    [queue, learning, wordIds, seed, show]
  );

  const counts = useMemo(() => {
    let due = learning.size;
    let fresh = 0;
    for (const id of queue) {
      const c = cards.current.get(id);
      if (!c || c.state === State.New) fresh++;
      else due++;
    }
    return { due, new: fresh };
  }, [queue, learning]);

  /** Reviews due by the end of the next study day, for the "tomorrow" forecast. */
  const dueTomorrow = useMemo(() => {
    if (currentId) return 0;
    const tomorrowEnd = endOfStudyDay(new Date(Date.now() + 86_400_000)).getTime();
    let n = 0;
    for (const c of cards.current.values()) if (c.state !== State.New && c.due.getTime() < tomorrowEnd) n++;
    return n;
  }, [currentId]);

  return {
    loading,
    current: currentId ? wordsById.get(currentId) : undefined,
    /** Changes every time a card is shown, even when the same word returns. */
    cardKey: shownAt,
    currentCard,
    isNew,
    revealed,
    reveal,
    answer,
    undo,
    canUndo: undoStack.length > 0,
    learnMore,
    previews,
    counts,
    stats,
    newDoneToday,
    dueTomorrow,
    storageError,
  };
}
