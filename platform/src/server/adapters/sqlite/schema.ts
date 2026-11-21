/**
 * SQLite tables (Drizzle ORM). Every tenant-owned row carries creator_id or
 * deck_id, and ids are UUIDs, so the same shape moves to Postgres later
 * (swap sqliteTable for pgTable and text JSON columns for jsonb).
 */
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Branding, Example, ScriptMeta } from '../../../core/types';
import type { RuleOverrides } from '../../../core/rules';
import type { SrsState } from '../../../core/srs';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['guest', 'member'] }).notNull(),
    role: text('role', { enum: ['learner', 'admin'] }).notNull().default('learner'),
    username: text('username'),
    displayName: text('display_name').notNull(),
    email: text('email'),
    passwordHash: text('password_hash'),
    googleSub: text('google_sub'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('users_username_uq').on(t.username), uniqueIndex('users_google_sub_uq').on(t.googleSub)]
);

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

export const creators = sqliteTable(
  'creators',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    branding: text('branding', { mode: 'json' }).$type<Branding>().notNull().default({}),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id),
    moderationStatus: text('moderation_status', { enum: ['active', 'flagged', 'hidden'] }).notNull().default('active'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('creators_slug_uq').on(t.slug), uniqueIndex('creators_owner_uq').on(t.ownerUserId)]
);

export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => creators.id),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    targetLang: text('target_lang').notNull(),
    sourceLang: text('source_lang').notNull(),
    altLang: text('alt_lang'),
    scriptMeta: text('script_meta', { mode: 'json' }).$type<ScriptMeta>().notNull(),
    ruleOverrides: text('ruleset', { mode: 'json' }).$type<RuleOverrides>().notNull().default({}),
    branding: text('branding', { mode: 'json' }).$type<Branding>().notNull().default({}),
    visibility: text('visibility', { enum: ['public', 'unlisted'] }).notNull().default('public'),
    moderationStatus: text('moderation_status', { enum: ['active', 'flagged', 'hidden'] }).notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('decks_code_uq').on(t.code), index('decks_creator_idx').on(t.creatorId)]
);

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    term: text('term').notNull(),
    reading: text('reading'),
    meaning: text('meaning').notNull(),
    meaningAlt: text('meaning_alt'),
    pos: text('pos'),
    topic: text('topic'),
    examples: text('examples', { mode: 'json' }).$type<Example[]>().notNull().default([]),
    audioMediaId: text('audio_media_id'),
    imageMediaId: text('image_media_id'),
    writingPrompt: text('writing_prompt'),
    moderationStatus: text('moderation_status', { enum: ['active', 'flagged', 'hidden'] }).notNull().default('active'),
  },
  (t) => [index('cards_deck_idx').on(t.deckId, t.position)]
);

export const progress = sqliteTable(
  'progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    deckId: text('deck_id').notNull(),
    skill: text('skill', { enum: ['vocab', 'reading', 'listening', 'writing'] }).notNull(),
    state: text('state', { mode: 'json' }).$type<SrsState>().notNull(),
    due: text('due').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.cardId, t.skill] }), index('progress_deck_idx').on(t.userId, t.deckId, t.skill)]
);

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    deckId: text('deck_id').notNull(),
    cardId: text('card_id').notNull(),
    skill: text('skill').notNull(),
    outcome: text('outcome').notNull(),
    grade: integer('grade').notNull(),
    ms: integer('ms'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('attempts_user_deck_idx').on(t.userId, t.deckId)]
);

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    targetType: text('target_type', { enum: ['deck', 'card'] }).notNull(),
    targetId: text('target_id').notNull(),
    deckId: text('deck_id').notNull(),
    reason: text('reason', { enum: ['spam', 'offensive', 'wrong', 'copyright', 'other'] }).notNull(),
    note: text('note'),
    reporterId: text('reporter_id'),
    status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('reports_target_idx').on(t.targetType, t.targetId, t.status)]
);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  createdAt: text('created_at').notNull(),
});

export const rateEvents = sqliteTable(
  'rate_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    at: integer('at').notNull(),
  },
  (t) => [index('rate_events_key_idx').on(t.key, t.at)]
);
