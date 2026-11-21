/**
 * Saves answers: applies FSRS to the card for this learner and skill, and
 * keeps a log of every answer.
 */
import { z } from 'zod';
import { capRecognition } from '../../core/quiz';
import { review, type Grade, type SrsState } from '../../core/srs';
import { SKILL_MODES, type SkillMode, type User } from '../../core/types';
import type { DeckStore, ProgressStore } from '../ports';
import { DeckError, parseOrThrow } from './decks';

export const answerSchema = z.object({
  deckId: z.string(),
  cardId: z.string(),
  skill: z.enum(SKILL_MODES as [SkillMode, ...SkillMode[]]),
  grade: z.number().int().min(1).max(4),
  outcome: z.enum(['right', 'wrong', 'dontKnow', 'near']),
  ms: z.number().int().min(0).max(3_600_000).optional(),
});

export function createProgressService(deps: { decks: DeckStore; progress: ProgressStore; clock?: () => Date }) {
  const { decks, progress, clock = () => new Date() } = deps;
  return {
    async load(user: User, deckId: string, skill: SkillMode): Promise<Record<string, SrsState>> {
      return Object.fromEntries(await progress.getForDeck(user.id, deckId, skill));
    },

    async record(user: User, input: unknown): Promise<SrsState> {
      const a = parseOrThrow(answerSchema, input);
      const card = await decks.getCard(a.cardId);
      if (!card || card.deckId !== a.deckId) throw new DeckError('Card not found.', 404);
      const now = clock();
      const prev = await progress.get(user.id, a.cardId, a.skill);
      // Only producing the word (writing) earns gaps over a week.
      const next = capRecognition(review(prev ?? undefined, a.grade as Grade, now), a.skill === 'writing', now);
      await progress.save(user.id, a.deckId, a.cardId, a.skill, next);
      await progress.logAttempt({ userId: user.id, deckId: a.deckId, cardId: a.cardId, skill: a.skill, outcome: a.outcome, grade: a.grade, ms: a.ms });
      return next;
    },

    stats: (user: User, deckId: string) => progress.stats(user.id, deckId),
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
