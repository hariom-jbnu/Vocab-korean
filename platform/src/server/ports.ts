/**
 * Ports: the interfaces between the app and the outside world.
 *
 * Services and HTTP routes only talk to these. Today each one has a local
 * adapter (SQLite file, local folder, mock Google). To go to production, add
 * a cloud adapter that implements the same interface (Postgres/Supabase,
 * S3/R2, real Google OAuth) and switch it in container.ts. Nothing in core/,
 * services/ or http/ needs to change.
 */
import type { Branding, Card, Creator, Deck, ModerationStatus, Report, ReportTarget, SkillMode, User, Visibility } from '../core/types';
import type { SrsState } from '../core/srs';

/* ---------------- Data stores ---------------- */

export type NewDeck = Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'moderationStatus'> & { moderationStatus?: ModerationStatus };
export type DeckPatch = Partial<Pick<Deck, 'title' | 'description' | 'targetLang' | 'sourceLang' | 'altLang' | 'scriptMeta' | 'ruleOverrides' | 'branding' | 'visibility' | 'moderationStatus'>>;
export type NewCard = Omit<Card, 'id' | 'deckId' | 'position' | 'moderationStatus'> & { id?: string };

export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`Deck code ${code} is already taken.`);
    this.name = 'DuplicateCodeError';
  }
}

export interface DeckStore {
  /** Throws DuplicateCodeError if the code is taken (the store's unique index is the final guard). */
  create(deck: NewDeck): Promise<Deck>;
  getById(id: string): Promise<Deck | null>;
  getByCode(code: string): Promise<Deck | null>;
  codeExists(code: string): Promise<boolean>;
  listByCreator(creatorId: string, opts?: { visibility?: Visibility; includeHidden?: boolean }): Promise<Deck[]>;
  update(id: string, patch: DeckPatch): Promise<Deck | null>;
  delete(id: string): Promise<void>;
  listCards(deckId: string, opts?: { includeHidden?: boolean }): Promise<Card[]>;
  getCard(id: string): Promise<Card | null>;
  /** Replace all cards of a deck, in the given order. Keeps ids that are passed in, so progress survives edits. */
  replaceCards(deckId: string, cards: NewCard[]): Promise<Card[]>;
  setCardStatus(id: string, status: ModerationStatus): Promise<void>;
  countCards(deckId: string): Promise<number>;
}

export interface CreatorStore {
  create(input: { slug: string; displayName: string; ownerUserId: string; branding?: Branding }): Promise<Creator>;
  getById(id: string): Promise<Creator | null>;
  getBySlug(slug: string): Promise<Creator | null>;
  getByOwner(userId: string): Promise<Creator | null>;
  update(id: string, patch: Partial<Pick<Creator, 'displayName' | 'branding' | 'moderationStatus'>>): Promise<Creator | null>;
}

export interface StoredUser extends User {
  passwordHash?: string;
  googleSub?: string;
}

export interface UserStore {
  create(input: Omit<StoredUser, 'id' | 'createdAt'>): Promise<StoredUser>;
  getById(id: string): Promise<StoredUser | null>;
  getByUsername(username: string): Promise<StoredUser | null>;
  getByGoogleSub(sub: string): Promise<StoredUser | null>;
  update(id: string, patch: Partial<Omit<StoredUser, 'id' | 'createdAt'>>): Promise<StoredUser | null>;
  createSession(input: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
  getSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  /** Move everything a guest did to another user (when a guest signs in to an existing account). */
  mergeUser(fromUserId: string, intoUserId: string): Promise<void>;
}

export interface Attempt {
  userId: string;
  deckId: string;
  cardId: string;
  skill: SkillMode;
  outcome: string;
  grade: number;
  ms?: number;
}

export interface ProgressStore {
  /** Memory state of every studied card in a deck, for one learner and skill. */
  getForDeck(userId: string, deckId: string, skill: SkillMode): Promise<Map<string, SrsState>>;
  get(userId: string, cardId: string, skill: SkillMode): Promise<SrsState | null>;
  save(userId: string, deckId: string, cardId: string, skill: SkillMode, state: SrsState): Promise<void>;
  logAttempt(a: Attempt): Promise<void>;
  /** Studied cards and answers per skill, for a learner in a deck. */
  stats(userId: string, deckId: string): Promise<Record<SkillMode, { studied: number; answers: number }>>;
}

export interface ReportStore {
  create(input: Omit<Report, 'id' | 'createdAt' | 'status'>): Promise<Report>;
  countOpen(targetType: ReportTarget, targetId: string): Promise<number>;
  listOpen(): Promise<Report[]>;
  resolveForTarget(targetType: ReportTarget, targetId: string): Promise<void>;
}

/* ---------------- Infrastructure ---------------- */

export interface StoredMedia {
  id: string;
  mime: string;
  size: number;
  /** Public URL path, e.g. /media/abc.png. */
  url: string;
}

export interface MediaStore {
  put(input: { bytes: Uint8Array; mime: string; ownerId: string }): Promise<StoredMedia>;
  get(id: string): Promise<{ bytes: Uint8Array; mime: string } | null>;
  remove(id: string): Promise<void>;
}

export interface RateLimiter {
  /** Count one action for `key`; ok is false once `limit` actions happened within `windowMs`. */
  hit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number }>;
}

export interface GoogleProfile {
  sub: string;
  email?: string;
  name?: string;
}

/**
 * Google sign-in. The local mock shows a "pretend Google" page; the real
 * provider would redirect to accounts.google.com and verify the id token.
 */
export interface GoogleProvider {
  readonly kind: 'mock' | 'google';
  /** Where to send the browser to start signing in. */
  authorizeUrl(state: string): string;
  /** Turn the callback's query (code, or the mock's form fields) into a profile. */
  exchange(params: Record<string, string>): Promise<GoogleProfile>;
}

/* ---------------- Services exposed to HTTP ---------------- */

export interface SessionInfo {
  user: User;
  token: string;
  expiresAt: Date;
}

export interface AuthService {
  /** Start practicing without an account. */
  startGuest(): Promise<SessionInfo>;
  /** Create an account. If `currentUserId` is a guest, the guest becomes this account and keeps its progress. */
  register(input: { username: string; password: string; displayName?: string }, currentUserId?: string): Promise<SessionInfo>;
  login(input: { username: string; password: string }, currentUserId?: string): Promise<SessionInfo>;
  /** Finish Google sign-in with a verified profile. */
  signInWithGoogle(profile: GoogleProfile, currentUserId?: string): Promise<SessionInfo>;
  /** The user behind a session token, or null if it is unknown or expired. */
  getUser(token: string): Promise<User | null>;
  logout(token: string): Promise<void>;
}

export interface ModerationService {
  /** Report a deck or card. Enough open reports flag it automatically. */
  report(input: { targetType: ReportTarget; targetId: string; reason: Report['reason']; note?: string; reporterId?: string; reporterKey: string }): Promise<{ report: Report; status: ModerationStatus }>;
  setStatus(targetType: ReportTarget, targetId: string, status: ModerationStatus): Promise<void>;
  queue(): Promise<Array<Report & { targetTitle: string; deckCode?: string; targetStatus: ModerationStatus }>>;
}
