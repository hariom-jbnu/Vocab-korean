/**
 * Deck use cases: create with a unique 4-character code, edit rules and
 * branding, edit cards, and load a deck for practice.
 */
import { z } from 'zod';
import { generateUniqueCode } from '../../core/code';
import { cleanOverrides, resolveRules } from '../../core/rules';
import { defaultScriptMeta } from '../../core/script';
import { MAX_CARDS, parseCardText, type CardDraft } from '../../core/cardText';
import { mergeBranding } from '../../core/branding';
import type { Branding, Card, Creator, Deck, PracticeDeck, User } from '../../core/types';
import { DuplicateCodeError, type CreatorStore, type DeckPatch, type DeckStore, type NewCard, type RateLimiter } from '../ports';

export class DeckError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 429 = 400,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'DeckError';
  }
}

/** Deck creation limit per account and per network address. */
export const CREATE_LIMIT = { count: 10, windowMs: 60 * 60 * 1000 };

const lang = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Use a language code such as ko, en, hi or pt-BR.');

const scriptMetaSchema = z.object({
  script: z.string().trim().regex(/^[A-Z][a-z]{3}$/, 'Use a 4-letter script code such as Hang, Latn or Deva.'),
  direction: z.enum(['ltr', 'rtl']),
  readingLabel: z.string().trim().min(1).max(30),
  ttsLang: lang.optional(),
  caseSensitive: z.boolean().optional(),
});

const hex = /^#[0-9a-fA-F]{6}$/;
export const brandingSchema = z
  .object({
    title: z.string().trim().max(60).optional(),
    note: z.string().trim().max(120).optional(),
    badge: z.string().trim().max(16).optional(),
    logoMediaId: z
      .string()
      .regex(/^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/)
      .optional(),
    color: z.string().regex(hex, 'Use a color like #0f766e.').optional(),
  })
  .transform((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== '')) as Branding);

const exampleSchema = z.object({ text: z.string().trim().min(1).max(300), translation: z.string().trim().max(300).optional(), reading: z.string().trim().max(300).optional() });

export const cardSchema = z.object({
  id: z.string().optional(),
  term: z.string().trim().min(1).max(120),
  meaning: z.string().trim().min(1).max(300),
  reading: z.string().trim().max(120).optional(),
  meaningAlt: z.string().trim().max(300).optional(),
  pos: z.string().trim().max(20).optional(),
  topic: z.string().trim().max(60).optional(),
  examples: z.array(exampleSchema).max(5).default([]),
  audioMediaId: z.string().optional(),
  imageMediaId: z.string().optional(),
  writingPrompt: z.string().trim().max(300).optional(),
});

export const createDeckSchema = z.object({
  title: z.string().trim().min(2, 'Give the deck a title.').max(80),
  description: z.string().trim().max(500).default(''),
  targetLang: lang,
  sourceLang: lang,
  altLang: lang.optional().or(z.literal('').transform(() => undefined)),
  scriptMeta: scriptMetaSchema.optional(),
  visibility: z.enum(['public', 'unlisted']).default('public'),
  cardText: z.string().max(200_000).optional(),
  cards: z.array(cardSchema).max(MAX_CARDS).optional(),
  rules: z.unknown().optional(),
  branding: brandingSchema.optional(),
});

export const updateDeckSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  targetLang: lang.optional(),
  sourceLang: lang.optional(),
  altLang: lang.optional().or(z.literal('').transform(() => undefined)),
  scriptMeta: scriptMetaSchema.optional(),
  visibility: z.enum(['public', 'unlisted']).optional(),
  rules: z.unknown().optional(),
  branding: brandingSchema.optional(),
});

const first = (issues: z.core.$ZodIssue[]) => {
  const i = issues[0];
  return i ? `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}` : 'Invalid input.';
};

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) throw new DeckError(first(r.error.issues));
  return r.data;
}

/** Match edited lines to existing cards by term, so progress, audio and extra examples survive an edit. */
export function mergeDrafts(drafts: readonly CardDraft[], existing: readonly Card[]): NewCard[] {
  const byTerm = new Map<string, Card>();
  for (const c of existing) if (!byTerm.has(c.term)) byTerm.set(c.term, c);
  const used = new Set<string>();
  return drafts.map((d) => {
    const prev = byTerm.get(d.term);
    if (!prev || used.has(prev.id)) return { ...d };
    used.add(prev.id);
    const examples = d.examples.length ? [d.examples[0], ...prev.examples.slice(1)] : prev.examples.slice(1);
    return { ...prev, ...d, id: prev.id, examples, reading: d.reading, meaningAlt: d.meaningAlt, writingPrompt: d.writingPrompt };
  });
}

export function createDeckService(deps: { decks: DeckStore; creators: CreatorStore; limiter: RateLimiter }) {
  const { decks, creators, limiter } = deps;

  async function creatorFor(user: User): Promise<Creator> {
    if (user.kind !== 'member') throw new DeckError('Sign in to create decks.', 403);
    const creator = await creators.getByOwner(user.id);
    if (!creator) throw new DeckError('Your account has no creator page yet.', 403);
    return creator;
  }

  async function ownedDeck(user: User, id: string): Promise<Deck> {
    const deck = await decks.getById(id);
    if (!deck) throw new DeckError('Deck not found.', 404);
    if (user.role === 'admin') return deck;
    const creator = await creators.getByOwner(user.id);
    if (!creator || creator.id !== deck.creatorId) throw new DeckError('This is not your deck.', 403);
    return deck;
  }

  async function checkLimit(key: string) {
    const r = await limiter.hit(key, CREATE_LIMIT.count, CREATE_LIMIT.windowMs);
    if (!r.ok) throw new DeckError(`You are creating decks too fast. Try again in ${Math.ceil(r.retryAfterMs / 60000)} minutes.`, 429, r.retryAfterMs);
  }

  return {
    async create(user: User, input: unknown, clientKey: string): Promise<Deck> {
      const data = parseOrThrow(createDeckSchema, input);
      const creator = await creatorFor(user);
      await checkLimit(`deck-create:user:${user.id}`);
      await checkLimit(`deck-create:client:${clientKey}`);

      let cards: NewCard[] = data.cards ?? [];
      if (data.cardText) {
        const parsed = parseCardText(data.cardText);
        if (parsed.errors.length) throw new DeckError(`Line ${parsed.errors[0].line}: ${parsed.errors[0].message}`);
        cards = parsed.cards;
      }

      const base = {
        creatorId: creator.id,
        title: data.title,
        description: data.description,
        targetLang: data.targetLang,
        sourceLang: data.sourceLang,
        altLang: data.altLang,
        scriptMeta: data.scriptMeta ?? defaultScriptMeta(data.targetLang),
        ruleOverrides: cleanOverrides(data.rules),
        branding: data.branding ?? {},
        visibility: data.visibility,
      };
      // Two decks created at the same moment could draw the same free code;
      // the unique index catches it and we simply draw again.
      for (let attempt = 0; ; attempt++) {
        const code = await generateUniqueCode((c) => decks.codeExists(c));
        try {
          const deck = await decks.create({ ...base, code });
          if (cards.length) await decks.replaceCards(deck.id, cards);
          return deck;
        } catch (e) {
          if (!(e instanceof DuplicateCodeError) || attempt >= 2) throw e;
        }
      }
    },

    async update(user: User, id: string, input: unknown): Promise<Deck> {
      const data = parseOrThrow(updateDeckSchema, input);
      await ownedDeck(user, id);
      const patch: DeckPatch = {};
      for (const key of ['title', 'description', 'targetLang', 'sourceLang', 'scriptMeta', 'visibility', 'branding'] as const) {
        if (data[key] !== undefined) (patch as Record<string, unknown>)[key] = data[key];
      }
      if ('altLang' in data) patch.altLang = data.altLang;
      if (data.rules !== undefined) patch.ruleOverrides = cleanOverrides(data.rules);
      return (await decks.update(id, patch))!;
    },

    async remove(user: User, id: string) {
      await ownedDeck(user, id);
      await decks.delete(id);
    },

    /** Replace cards from the one-card-per-line text editor. */
    async saveCardText(user: User, id: string, text: string): Promise<Card[]> {
      await ownedDeck(user, id);
      const parsed = parseCardText(text);
      if (parsed.errors.length) throw new DeckError(`Line ${parsed.errors[0].line}: ${parsed.errors[0].message}`);
      const existing = await decks.listCards(id, { includeHidden: true });
      return decks.replaceCards(id, mergeDrafts(parsed.cards, existing));
    },

    async setCardAudio(user: User, deckId: string, cardId: string, mediaId: string | undefined): Promise<Card[]> {
      await ownedDeck(user, deckId);
      const cards = await decks.listCards(deckId, { includeHidden: true });
      if (!cards.some((c) => c.id === cardId)) throw new DeckError('Card not found.', 404);
      return decks.replaceCards(
        deckId,
        cards.map((c) => (c.id === cardId ? { ...c, audioMediaId: mediaId } : c))
      );
    },

    /** Everything the deck editor needs. */
    async getForOwner(user: User, id: string) {
      const deck = await ownedDeck(user, id);
      const creator = (await creators.getById(deck.creatorId))!;
      return { deck, rules: resolveRules(deck.ruleOverrides), creator, cards: await decks.listCards(id, { includeHidden: true }) };
    },

    async listMine(user: User) {
      const creator = await creatorFor(user);
      const list = await decks.listByCreator(creator.id, { includeHidden: true });
      return { creator, decks: await Promise.all(list.map(async (d) => ({ ...d, cardCount: await decks.countCards(d.id) }))) };
    },

    /** Load a deck by its code for practice. Hidden decks (and decks of hidden creators) are not found. */
    async getForPractice(code: string): Promise<PracticeDeck> {
      const deck = await decks.getByCode(code);
      if (!deck || deck.moderationStatus === 'hidden') throw new DeckError('No deck has this code.', 404);
      const creator = await creators.getById(deck.creatorId);
      if (!creator || creator.moderationStatus === 'hidden') throw new DeckError('No deck has this code.', 404);
      const { ruleOverrides, ...rest } = deck;
      return {
        deck: rest,
        rules: resolveRules(ruleOverrides),
        branding: mergeBranding(creator.branding, deck.branding),
        creator: { slug: creator.slug, displayName: creator.displayName },
        cards: await decks.listCards(deck.id),
      };
    },

    /** A creator's public page: their branding and listed decks. */
    async getCreatorPage(slug: string) {
      const creator = await creators.getBySlug(slug);
      if (!creator || creator.moderationStatus === 'hidden') throw new DeckError('No creator with this name.', 404);
      const list = await decks.listByCreator(creator.id, { visibility: 'public' });
      return {
        creator: { slug: creator.slug, displayName: creator.displayName, branding: creator.branding },
        decks: await Promise.all(
          list.map(async (d) => ({ code: d.code, title: d.title, description: d.description, targetLang: d.targetLang, sourceLang: d.sourceLang, moderationStatus: d.moderationStatus, cardCount: await decks.countCards(d.id) }))
        ),
      };
    },

    async updateCreator(user: User, input: unknown) {
      const creator = await creatorFor(user);
      const data = parseOrThrow(z.object({ displayName: z.string().trim().min(1).max(60).optional(), branding: brandingSchema.optional() }), input);
      return creators.update(creator.id, data);
    },
  };
}

export type DeckService = ReturnType<typeof createDeckService>;
