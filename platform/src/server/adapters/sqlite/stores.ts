/**
 * SQLite implementations of the store ports. Each function returns a plain
 * object that satisfies one interface from ports.ts.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import type { Card, Creator, Deck, Report, SkillMode } from '../../../core/types';
import { SKILL_MODES } from '../../../core/types';
import type { CreatorStore, DeckStore, ProgressStore, RateLimiter, ReportStore, StoredUser, UserStore } from '../../ports';
import { DuplicateCodeError } from '../../ports';
import type { Db } from './db';
import * as t from './schema';

const now = () => new Date().toISOString();
const orUndef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

const isUniqueViolation = (e: unknown, index: string) => e instanceof Error && /UNIQUE constraint failed/.test(e.message) && e.message.includes(index);

/* ---------------- Decks and cards ---------------- */

function toDeck(r: typeof t.decks.$inferSelect): Deck {
  return {
    id: r.id,
    creatorId: r.creatorId,
    code: r.code,
    title: r.title,
    description: r.description,
    targetLang: r.targetLang,
    sourceLang: r.sourceLang,
    altLang: orUndef(r.altLang),
    scriptMeta: r.scriptMeta,
    ruleOverrides: r.ruleOverrides,
    branding: r.branding,
    visibility: r.visibility,
    moderationStatus: r.moderationStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toCard(r: typeof t.cards.$inferSelect): Card {
  return {
    id: r.id,
    deckId: r.deckId,
    position: r.position,
    term: r.term,
    reading: orUndef(r.reading),
    meaning: r.meaning,
    meaningAlt: orUndef(r.meaningAlt),
    pos: orUndef(r.pos),
    topic: orUndef(r.topic),
    examples: r.examples,
    audioMediaId: orUndef(r.audioMediaId),
    imageMediaId: orUndef(r.imageMediaId),
    writingPrompt: orUndef(r.writingPrompt),
    moderationStatus: r.moderationStatus,
  };
}

export function sqliteDeckStore(db: Db): DeckStore {
  return {
    async create(input) {
      const ts = now();
      const row = { ...input, id: randomUUID(), altLang: input.altLang ?? null, moderationStatus: input.moderationStatus ?? 'active', createdAt: ts, updatedAt: ts };
      try {
        db.insert(t.decks).values(row).run();
      } catch (e) {
        if (isUniqueViolation(e, 'decks.code')) throw new DuplicateCodeError(input.code);
        throw e;
      }
      return toDeck(row as typeof t.decks.$inferSelect);
    },
    async getById(id) {
      const r = db.select().from(t.decks).where(eq(t.decks.id, id)).get();
      return r ? toDeck(r) : null;
    },
    async getByCode(code) {
      const r = db.select().from(t.decks).where(eq(t.decks.code, code)).get();
      return r ? toDeck(r) : null;
    },
    async codeExists(code) {
      return !!db.select({ id: t.decks.id }).from(t.decks).where(eq(t.decks.code, code)).get();
    },
    async listByCreator(creatorId, opts = {}) {
      const conds = [eq(t.decks.creatorId, creatorId)];
      if (opts.visibility) conds.push(eq(t.decks.visibility, opts.visibility));
      if (!opts.includeHidden) conds.push(ne(t.decks.moderationStatus, 'hidden'));
      return db.select().from(t.decks).where(and(...conds)).orderBy(asc(t.decks.createdAt)).all().map(toDeck);
    },
    async update(id, patch) {
      const set: Partial<typeof t.decks.$inferInsert> = { ...patch, updatedAt: now() };
      if ('altLang' in patch) set.altLang = patch.altLang ?? null;
      db.update(t.decks).set(set).where(eq(t.decks.id, id)).run();
      return this.getById(id);
    },
    async delete(id) {
      db.delete(t.decks).where(eq(t.decks.id, id)).run();
    },
    async listCards(deckId, opts = {}) {
      const conds = [eq(t.cards.deckId, deckId)];
      if (!opts.includeHidden) conds.push(ne(t.cards.moderationStatus, 'hidden'));
      return db.select().from(t.cards).where(and(...conds)).orderBy(asc(t.cards.position)).all().map(toCard);
    },
    async getCard(id) {
      const r = db.select().from(t.cards).where(eq(t.cards.id, id)).get();
      return r ? toCard(r) : null;
    },
    async replaceCards(deckId, input) {
      const existing = new Map(db.select().from(t.cards).where(eq(t.cards.deckId, deckId)).all().map((c) => [c.id, c]));
      db.transaction((tx) => {
        const keep = new Set<string>();
        input.forEach((c, position) => {
          const prev = c.id ? existing.get(c.id) : undefined;
          const row = {
            id: prev ? prev.id : randomUUID(),
            deckId,
            position,
            term: c.term,
            reading: c.reading ?? null,
            meaning: c.meaning,
            meaningAlt: c.meaningAlt ?? null,
            pos: c.pos ?? null,
            topic: c.topic ?? null,
            examples: c.examples ?? [],
            audioMediaId: c.audioMediaId ?? null,
            imageMediaId: c.imageMediaId ?? null,
            writingPrompt: c.writingPrompt ?? null,
            moderationStatus: prev?.moderationStatus ?? 'active',
          };
          keep.add(row.id);
          if (prev) tx.update(t.cards).set(row).where(eq(t.cards.id, row.id)).run();
          else tx.insert(t.cards).values(row).run();
        });
        const gone = [...existing.keys()].filter((id) => !keep.has(id));
        if (gone.length) tx.delete(t.cards).where(inArray(t.cards.id, gone)).run();
        tx.update(t.decks).set({ updatedAt: now() }).where(eq(t.decks.id, deckId)).run();
      });
      return this.listCards(deckId, { includeHidden: true });
    },
    async setCardStatus(id, status) {
      db.update(t.cards).set({ moderationStatus: status }).where(eq(t.cards.id, id)).run();
    },
    async countCards(deckId) {
      return db.select({ n: count() }).from(t.cards).where(and(eq(t.cards.deckId, deckId), ne(t.cards.moderationStatus, 'hidden'))).get()?.n ?? 0;
    },
  };
}

/* ---------------- Creators ---------------- */

const toCreator = (r: typeof t.creators.$inferSelect): Creator => ({ ...r });

export function sqliteCreatorStore(db: Db): CreatorStore {
  return {
    async create(input) {
      const row = { id: randomUUID(), slug: input.slug, displayName: input.displayName, ownerUserId: input.ownerUserId, branding: input.branding ?? {}, moderationStatus: 'active' as const, createdAt: now() };
      db.insert(t.creators).values(row).run();
      return toCreator(row);
    },
    async getById(id) {
      const r = db.select().from(t.creators).where(eq(t.creators.id, id)).get();
      return r ? toCreator(r) : null;
    },
    async getBySlug(slug) {
      const r = db.select().from(t.creators).where(eq(t.creators.slug, slug)).get();
      return r ? toCreator(r) : null;
    },
    async getByOwner(userId) {
      const r = db.select().from(t.creators).where(eq(t.creators.ownerUserId, userId)).get();
      return r ? toCreator(r) : null;
    },
    async update(id, patch) {
      db.update(t.creators).set(patch).where(eq(t.creators.id, id)).run();
      return this.getById(id);
    },
  };
}

/* ---------------- Users and sessions ---------------- */

function toUser(r: typeof t.users.$inferSelect): StoredUser {
  return {
    id: r.id,
    kind: r.kind,
    role: r.role,
    username: orUndef(r.username),
    displayName: r.displayName,
    email: orUndef(r.email),
    passwordHash: orUndef(r.passwordHash),
    googleSub: orUndef(r.googleSub),
    createdAt: r.createdAt,
  };
}

export function sqliteUserStore(db: Db): UserStore {
  return {
    async create(input) {
      const row = { id: randomUUID(), createdAt: now(), ...input, username: input.username ?? null, email: input.email ?? null, passwordHash: input.passwordHash ?? null, googleSub: input.googleSub ?? null };
      db.insert(t.users).values(row).run();
      return toUser(row);
    },
    async getById(id) {
      const r = db.select().from(t.users).where(eq(t.users.id, id)).get();
      return r ? toUser(r) : null;
    },
    async getByUsername(username) {
      const r = db.select().from(t.users).where(eq(t.users.username, username)).get();
      return r ? toUser(r) : null;
    },
    async getByGoogleSub(sub) {
      const r = db.select().from(t.users).where(eq(t.users.googleSub, sub)).get();
      return r ? toUser(r) : null;
    },
    async update(id, patch) {
      db.update(t.users).set(patch).where(eq(t.users.id, id)).run();
      return this.getById(id);
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      db.insert(t.sessions).values({ tokenHash, userId, expiresAt: expiresAt.getTime(), createdAt: now() }).run();
    },
    async getSession(tokenHash) {
      const r = db.select().from(t.sessions).where(eq(t.sessions.tokenHash, tokenHash)).get();
      return r ? { userId: r.userId, expiresAt: new Date(r.expiresAt) } : null;
    },
    async deleteSession(tokenHash) {
      db.delete(t.sessions).where(eq(t.sessions.tokenHash, tokenHash)).run();
    },
    async mergeUser(from, into) {
      if (from === into) return;
      db.transaction((tx) => {
        // Keep the account's own progress where both studied the same card.
        const theirs = new Set(tx.select().from(t.progress).where(eq(t.progress.userId, into)).all().map((p) => `${p.cardId}|${p.skill}`));
        for (const p of tx.select().from(t.progress).where(eq(t.progress.userId, from)).all()) {
          if (theirs.has(`${p.cardId}|${p.skill}`)) continue;
          tx.insert(t.progress).values({ ...p, userId: into }).run();
        }
        tx.delete(t.progress).where(eq(t.progress.userId, from)).run();
        tx.update(t.attempts).set({ userId: into }).where(eq(t.attempts.userId, from)).run();
        tx.update(t.reports).set({ reporterId: into }).where(eq(t.reports.reporterId, from)).run();
        tx.delete(t.sessions).where(eq(t.sessions.userId, from)).run();
        tx.delete(t.users).where(and(eq(t.users.id, from), eq(t.users.kind, 'guest'))).run();
      });
    },
  };
}

/* ---------------- Progress ---------------- */

export function sqliteProgressStore(db: Db): ProgressStore {
  return {
    async getForDeck(userId, deckId, skill) {
      const rows = db
        .select()
        .from(t.progress)
        .where(and(eq(t.progress.userId, userId), eq(t.progress.deckId, deckId), eq(t.progress.skill, skill)))
        .all();
      return new Map(rows.map((r) => [r.cardId, r.state]));
    },
    async get(userId, cardId, skill) {
      const r = db
        .select()
        .from(t.progress)
        .where(and(eq(t.progress.userId, userId), eq(t.progress.cardId, cardId), eq(t.progress.skill, skill)))
        .get();
      return r ? r.state : null;
    },
    async save(userId, deckId, cardId, skill, state) {
      const row = { userId, deckId, cardId, skill, state, due: state.due, updatedAt: now() };
      db.insert(t.progress)
        .values(row)
        .onConflictDoUpdate({ target: [t.progress.userId, t.progress.cardId, t.progress.skill], set: { state, due: state.due, updatedAt: row.updatedAt } })
        .run();
    },
    async logAttempt(a) {
      db.insert(t.attempts)
        .values({ ...a, ms: a.ms ?? null, createdAt: now() })
        .run();
    },
    async stats(userId, deckId) {
      const out = Object.fromEntries(SKILL_MODES.map((m) => [m, { studied: 0, answers: 0 }])) as Record<SkillMode, { studied: number; answers: number }>;
      const studied = db
        .select({ skill: t.progress.skill, n: count() })
        .from(t.progress)
        .where(and(eq(t.progress.userId, userId), eq(t.progress.deckId, deckId)))
        .groupBy(t.progress.skill)
        .all();
      for (const r of studied) out[r.skill].studied = r.n;
      const answers = db
        .select({ skill: t.attempts.skill, n: count() })
        .from(t.attempts)
        .where(and(eq(t.attempts.userId, userId), eq(t.attempts.deckId, deckId)))
        .groupBy(t.attempts.skill)
        .all();
      for (const r of answers) if (r.skill in out) out[r.skill as SkillMode].answers = r.n;
      return out;
    },
  };
}

/* ---------------- Reports ---------------- */

const toReport = (r: typeof t.reports.$inferSelect): Report => ({ ...r, note: orUndef(r.note), reporterId: orUndef(r.reporterId) });

export function sqliteReportStore(db: Db): ReportStore {
  return {
    async create(input) {
      const row = { id: randomUUID(), status: 'open' as const, createdAt: now(), ...input, note: input.note ?? null, reporterId: input.reporterId ?? null };
      db.insert(t.reports).values(row).run();
      return toReport(row);
    },
    async countOpen(targetType, targetId) {
      return (
        db
          // Distinct reporters, so one person reporting twice counts once.
          .select({ n: sql<number>`count(distinct coalesce(${t.reports.reporterId}, ${t.reports.id}))` })
          .from(t.reports)
          .where(and(eq(t.reports.targetType, targetType), eq(t.reports.targetId, targetId), eq(t.reports.status, 'open')))
          .get()?.n ?? 0
      );
    },
    async listOpen() {
      return db.select().from(t.reports).where(eq(t.reports.status, 'open')).orderBy(asc(t.reports.createdAt)).all().map(toReport);
    },
    async resolveForTarget(targetType, targetId) {
      db.update(t.reports)
        .set({ status: 'resolved' })
        .where(and(eq(t.reports.targetType, targetType), eq(t.reports.targetId, targetId)))
        .run();
    },
  };
}

/* ---------------- Rate limiting ---------------- */

/** Sliding-window limiter kept in SQLite, so limits survive a restart. */
export function sqliteRateLimiter(db: Db, clock: () => number = Date.now): RateLimiter {
  return {
    async hit(key, limit, windowMs) {
      const at = clock();
      const since = at - windowMs;
      return db.transaction((tx) => {
        tx.delete(t.rateEvents).where(and(eq(t.rateEvents.key, key), lt(t.rateEvents.at, since))).run();
        const recent = tx
          .select({ at: t.rateEvents.at })
          .from(t.rateEvents)
          .where(and(eq(t.rateEvents.key, key), gte(t.rateEvents.at, since)))
          .orderBy(asc(t.rateEvents.at))
          .all();
        if (recent.length >= limit) return { ok: false, retryAfterMs: Math.max(0, recent[0].at + windowMs - at) };
        tx.insert(t.rateEvents).values({ key, at }).run();
        return { ok: true, retryAfterMs: 0 };
      });
    },
  };
}
