import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, type Container } from './container';
import { DuplicateCodeError, type NewDeck } from './ports';
import { sqliteRateLimiter } from './adapters/sqlite/stores';
import { defaultScriptMeta } from '../core/script';
import { newState } from '../core/srs';
import { DEFAULT_RULES } from '../core/rules';
import { FLAG_AT } from './services/moderation';
import { hashPassword, verifyPassword } from './services/auth';

let c: Container;
let mediaDir: string;

beforeEach(() => {
  mediaDir = mkdtempSync(join(tmpdir(), 'vocab-media-'));
  c = createContainer({ dbFile: ':memory:', mediaDir });
});
afterEach(() => {
  c.close();
  rmSync(mediaDir, { recursive: true, force: true });
});

async function teacher(username = 'priya') {
  const s = await c.auth.register({ username, password: 'secret123' });
  const creator = (await c.stores.creators.getByOwner(s.user.id))!;
  return { user: s.user, creator, token: s.token };
}

const deckInput = (creatorId: string, code: string): NewDeck => ({
  creatorId,
  code,
  title: 'Test deck',
  description: '',
  targetLang: 'ko',
  sourceLang: 'en',
  scriptMeta: defaultScriptMeta('ko'),
  ruleOverrides: {},
  branding: {},
  visibility: 'public',
});

describe('DeckStore (SQLite)', () => {
  it('creates, finds by code and lists decks per creator', async () => {
    const { creator } = await teacher();
    const deck = await c.stores.decks.create(deckInput(creator.id, 'A7K9'));
    expect(deck.moderationStatus).toBe('active');
    expect((await c.stores.decks.getByCode('A7K9'))?.id).toBe(deck.id);
    expect(await c.stores.decks.codeExists('A7K9')).toBe(true);
    expect(await c.stores.decks.codeExists('ZZZZ')).toBe(false);
    expect((await c.stores.decks.listByCreator(creator.id)).map((d) => d.code)).toEqual(['A7K9']);
  });

  it('refuses a second deck with the same code (unique index)', async () => {
    const { creator } = await teacher();
    await c.stores.decks.create(deckInput(creator.id, 'A7K9'));
    await expect(c.stores.decks.create(deckInput(creator.id, 'A7K9'))).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it('stores JSON fields (script, rules, branding) and updates them', async () => {
    const { creator } = await teacher();
    const deck = await c.stores.decks.create({ ...deckInput(creator.id, 'B2C3'), ruleOverrides: { notInList: false }, branding: { badge: 'A1' } });
    const updated = await c.stores.decks.update(deck.id, { ruleOverrides: { writing: { level: 'strict' } }, branding: { color: '#123456' } });
    expect(updated?.scriptMeta.script).toBe('Hang');
    expect(updated?.ruleOverrides).toEqual({ writing: { level: 'strict' } });
    expect(updated?.branding).toEqual({ color: '#123456' });
  });

  it('replaces cards in order and keeps ids that are passed back', async () => {
    const { creator } = await teacher();
    const deck = await c.stores.decks.create(deckInput(creator.id, 'C4D5'));
    const first = await c.stores.decks.replaceCards(deck.id, [
      { term: '물', meaning: 'water', examples: [] },
      { term: '책', meaning: 'book', examples: [{ text: '책을 읽어요.' }] },
    ]);
    expect(first.map((x) => [x.position, x.term])).toEqual([
      [0, '물'],
      [1, '책'],
    ]);
    const second = await c.stores.decks.replaceCards(deck.id, [{ ...first[1], meaning: 'a book' }, { term: '집', meaning: 'house', examples: [] }]);
    expect(second[0].id).toBe(first[1].id);
    expect(second[0].meaning).toBe('a book');
    expect(second[0].examples).toEqual([{ text: '책을 읽어요.' }]);
    expect(await c.stores.decks.getCard(first[0].id)).toBeNull();
  });

  it('hides hidden cards from learners but not from the owner', async () => {
    const { creator } = await teacher();
    const deck = await c.stores.decks.create(deckInput(creator.id, 'E6F7'));
    const [a] = await c.stores.decks.replaceCards(deck.id, [
      { term: '물', meaning: 'water', examples: [] },
      { term: '책', meaning: 'book', examples: [] },
    ]);
    await c.stores.decks.setCardStatus(a.id, 'hidden');
    expect(await c.stores.decks.listCards(deck.id)).toHaveLength(1);
    expect(await c.stores.decks.listCards(deck.id, { includeHidden: true })).toHaveLength(2);
    expect(await c.stores.decks.countCards(deck.id)).toBe(1);
  });
});

describe('ProgressStore (SQLite)', () => {
  it('saves memory state per learner, card and skill', async () => {
    const { creator, user } = await teacher();
    const deck = await c.stores.decks.create(deckInput(creator.id, 'G8H9'));
    const [card] = await c.stores.decks.replaceCards(deck.id, [{ term: '물', meaning: 'water', examples: [] }]);
    const s = newState(new Date('2026-01-01T00:00:00Z'));
    await c.stores.progress.save(user.id, deck.id, card.id, 'vocab', s);
    await c.stores.progress.save(user.id, deck.id, card.id, 'vocab', { ...s, reps: 3 });
    expect((await c.stores.progress.get(user.id, card.id, 'vocab'))?.reps).toBe(3);
    expect(await c.stores.progress.get(user.id, card.id, 'writing')).toBeNull();
    expect((await c.stores.progress.getForDeck(user.id, deck.id, 'vocab')).size).toBe(1);
    await c.stores.progress.logAttempt({ userId: user.id, deckId: deck.id, cardId: card.id, skill: 'vocab', outcome: 'right', grade: 3 });
    const stats = await c.stores.progress.stats(user.id, deck.id);
    expect(stats.vocab).toEqual({ studied: 1, answers: 1 });
  });
});

describe('MediaStore (local folder)', () => {
  it('saves, reads and removes an upload', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const m = await c.media.put({ bytes, mime: 'image/png', ownerId: 'u1' });
    expect(m.url).toBe(`/media/${m.id}`);
    expect((await c.media.get(m.id))?.bytes).toEqual(Buffer.from(bytes));
    await c.media.remove(m.id);
    expect(await c.media.get(m.id)).toBeNull();
  });

  it('rejects unknown types and big files', async () => {
    await expect(c.media.put({ bytes: new Uint8Array(4), mime: 'image/svg+xml', ownerId: 'u1' })).rejects.toThrow(/not allowed/);
    await expect(c.media.put({ bytes: new Uint8Array(2_000_001), mime: 'image/png', ownerId: 'u1' })).rejects.toThrow(/too big/);
  });
});

describe('RateLimiter (SQLite)', () => {
  it('allows `limit` hits per window, then reopens', async () => {
    let now = 0;
    const limiter = sqliteRateLimiter(c.db, () => now);
    for (let i = 0; i < 3; i++) expect((await limiter.hit('k', 3, 1000)).ok).toBe(true);
    const blocked = await limiter.hit('k', 3, 1000);
    expect(blocked).toEqual({ ok: false, retryAfterMs: 1000 });
    expect((await limiter.hit('other', 3, 1000)).ok).toBe(true);
    now = 1001;
    expect((await limiter.hit('k', 3, 1000)).ok).toBe(true);
  });
});

describe('DeckService', () => {
  it('creates a deck with a fresh valid code, its cards and only changed rules', async () => {
    const { user } = await teacher();
    const deck = await c.decks.create(user, { title: 'Food', targetLang: 'ko', sourceLang: 'hi', cardText: '물 | पानी | mul\n밥 | चावल', rules: { ...DEFAULT_RULES, targetReps: 3 } }, 'ip1');
    expect(deck.code).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
    expect(deck.ruleOverrides).toEqual({ targetReps: 3 });
    expect(deck.scriptMeta.script).toBe('Hang');
    const practice = await c.decks.getForPractice(deck.code);
    expect(practice.cards.map((x) => x.term)).toEqual(['물', '밥']);
    expect(practice.rules.targetReps).toBe(3);
    expect(practice.rules.notInList).toBe(true);
  });

  it('gives every deck a different code', async () => {
    const { user } = await teacher();
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) codes.add((await c.decks.create(user, { title: `Deck ${i}`, targetLang: 'es', sourceLang: 'en' }, `ip${i}`)).code);
    expect(codes.size).toBe(10);
  });

  it('rate-limits deck creation per account', async () => {
    const { user } = await teacher();
    for (let i = 0; i < 10; i++) await c.decks.create(user, { title: `Deck ${i}`, targetLang: 'es', sourceLang: 'en' }, `ip${i}`);
    await expect(c.decks.create(user, { title: 'One too many', targetLang: 'es', sourceLang: 'en' }, 'ip99')).rejects.toMatchObject({ status: 429 });
  });

  it('only lets members create, and only owners edit', async () => {
    const guest = await c.auth.startGuest();
    await expect(c.decks.create(guest.user, { title: 'Nope', targetLang: 'es', sourceLang: 'en' }, 'ip')).rejects.toMatchObject({ status: 403 });
    const a = await teacher('alice');
    const b = await teacher('bobby');
    const deck = await c.decks.create(a.user, { title: 'Mine', targetLang: 'es', sourceLang: 'en' }, 'ip');
    await expect(c.decks.update(b.user, deck.id, { title: 'Stolen' })).rejects.toMatchObject({ status: 403 });
  });

  it('keeps card ids (and progress) when the word list is edited', async () => {
    const { user } = await teacher();
    const deck = await c.decks.create(user, { title: 'Edit me', targetLang: 'ko', sourceLang: 'en', cardText: '물 | water\n책 | book' }, 'ip');
    const before = await c.stores.decks.listCards(deck.id);
    const after = await c.decks.saveCardText(user, deck.id, '책 | a book\n집 | house\n물 | water');
    expect(after.find((x) => x.term === '물')?.id).toBe(before.find((x) => x.term === '물')?.id);
    expect(after.find((x) => x.term === '책')?.meaning).toBe('a book');
  });
});

describe('Moderation', () => {
  it('flags after reports from several people and hides on an admin decision', async () => {
    const { user } = await teacher();
    const deck = await c.decks.create(user, { title: 'Spam?', targetLang: 'es', sourceLang: 'en' }, 'ip');
    for (let i = 0; i < FLAG_AT; i++) {
      const g = await c.auth.startGuest();
      // The same person reporting twice counts once.
      await c.moderation.report({ targetType: 'deck', targetId: deck.id, reason: 'spam', reporterId: g.user.id, reporterKey: g.user.id });
      if (i === 0) await c.moderation.report({ targetType: 'deck', targetId: deck.id, reason: 'spam', reporterId: g.user.id, reporterKey: g.user.id });
      expect((await c.stores.decks.getById(deck.id))?.moderationStatus).toBe(i + 1 >= FLAG_AT ? 'flagged' : 'active');
    }
    expect((await c.moderation.queue()).length).toBeGreaterThan(0);
    await c.moderation.setStatus('deck', deck.id, 'hidden');
    await expect(c.decks.getForPractice(deck.code)).rejects.toMatchObject({ status: 404 });
    expect(await c.moderation.queue()).toEqual([]);
  });
});

describe('Auth', () => {
  it('hashes passwords and checks them', async () => {
    const h = await hashPassword('secret123');
    expect(h).not.toContain('secret123');
    expect(await verifyPassword('secret123', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('turns a guest into a member without losing progress', async () => {
    const guest = await c.auth.startGuest();
    const s = await c.auth.register({ username: 'Learner_1', password: 'secret123' }, guest.user.id);
    expect(s.user.id).toBe(guest.user.id);
    expect(s.user.kind).toBe('member');
    expect(s.user.username).toBe('learner_1');
    expect(await c.auth.getUser(s.token)).toMatchObject({ id: guest.user.id });
  });

  it('rejects a wrong password, a taken name and a logged-out token', async () => {
    const s = await c.auth.register({ username: 'sam', password: 'secret123' });
    await expect(c.auth.login({ username: 'sam', password: 'nope-nope' })).rejects.toMatchObject({ status: 401 });
    await expect(c.auth.register({ username: 'SAM', password: 'secret123' })).rejects.toMatchObject({ status: 409 });
    await c.auth.logout(s.token);
    expect(await c.auth.getUser(s.token)).toBeNull();
  });

  it('signs in with (mock) Google and reuses the account next time', async () => {
    const p = await c.google.exchange({ email: 'Gita@Example.com', name: 'Gita' });
    const a = await c.auth.signInWithGoogle(p);
    const b = await c.auth.signInWithGoogle(p);
    expect(a.user.id).toBe(b.user.id);
    expect(await c.stores.creators.getByOwner(a.user.id)).toMatchObject({ slug: 'gita' });
  });
});
