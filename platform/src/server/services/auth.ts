/**
 * Accounts and sessions: guests, username + password, and Google.
 *
 * - Learners start as guests (no sign-up); a guest who later signs up or
 *   signs in keeps the progress they made as a guest.
 * - Passwords are hashed with scrypt (node:crypto) and a random salt.
 * - A session is a random token in an httpOnly cookie; only its SHA-256 hash
 *   is stored, so a leaked database does not leak live sessions.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { User } from '../../core/types';
import type { AuthService, CreatorStore, GoogleProfile, SessionInfo, StoredUser, UserStore } from '../ports';
import { isValidSlug, normalizeSlug, SLUG_MIN } from '../../core/tenant';

export const SESSION_DAYS = 30;
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const PASSWORD_MIN = 8;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 409 = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/* ---------------- Passwords ---------------- */

const KEYLEN = 64;
const scryptAsync = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ---------------- Tokens ---------------- */

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const publicUser = (u: StoredUser): User => ({ id: u.id, kind: u.kind, role: u.role, username: u.username, displayName: u.displayName, email: u.email, createdAt: u.createdAt });

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Every member gets a creator page named after them (ravi -> /@ravi), so
 * anyone can make a deck. A taken or reserved slug gets a number added.
 */
async function ensureCreator(creators: CreatorStore, user: StoredUser): Promise<void> {
  if (await creators.getByOwner(user.id)) return;
  let base = normalizeSlug(user.username ?? user.displayName).slice(0, 24).replace(/-+$/, '');
  if (base.length < SLUG_MIN) base = base ? `teacher-${base}` : 'teacher';
  let slug = base;
  for (let i = 2; !isValidSlug(slug) || (await creators.getBySlug(slug)); i++) {
    slug = i < 1000 ? `${base}-${i}` : `teacher-${randomBytes(4).toString('hex')}`;
  }
  await creators.create({ slug, displayName: user.displayName, ownerUserId: user.id });
}

export function createAuthService(users: UserStore, creators: CreatorStore, clock: () => Date = () => new Date()): AuthService {
  async function issue(user: StoredUser): Promise<SessionInfo> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(clock().getTime() + SESSION_DAYS * 86_400_000);
    await users.createSession({ tokenHash: hashToken(token), userId: user.id, expiresAt });
    return { user: publicUser(user), token, expiresAt };
  }

  /** A guest signing in to an existing account brings their progress along. */
  async function absorbGuest(currentUserId: string | undefined, account: StoredUser) {
    if (!currentUserId || currentUserId === account.id) return;
    const current = await users.getById(currentUserId);
    if (current?.kind === 'guest') await users.mergeUser(current.id, account.id);
  }

  return {
    async startGuest() {
      const user = await users.create({ kind: 'guest', role: 'learner', displayName: 'Guest' });
      return issue(user);
    },

    async register({ username, password, displayName }, currentUserId) {
      const name = normalizeUsername(username);
      if (!USERNAME_RE.test(name)) throw new AuthError('Usernames are 3 to 24 characters: a to z, 0 to 9 and _.');
      if (password.length < PASSWORD_MIN) throw new AuthError(`Passwords need at least ${PASSWORD_MIN} characters.`);
      if (await users.getByUsername(name)) throw new AuthError('That username is taken.', 409);
      const fields = { kind: 'member' as const, username: name, displayName: displayName?.trim() || name, passwordHash: await hashPassword(password) };

      const current = currentUserId ? await users.getById(currentUserId) : null;
      // A guest becomes the new account in place, so nothing needs copying.
      const user = current?.kind === 'guest' ? await users.update(current.id, fields) : await users.create({ ...fields, role: 'learner' });
      if (!user) throw new AuthError('Could not create the account.');
      await ensureCreator(creators, user);
      return issue(user);
    },

    async login({ username, password }, currentUserId) {
      const user = await users.getByUsername(normalizeUsername(username));
      // Same message either way, so usernames cannot be probed.
      if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new AuthError('Wrong username or password.', 401);
      await absorbGuest(currentUserId, user);
      return issue(user);
    },

    async signInWithGoogle(profile: GoogleProfile, currentUserId) {
      let user = await users.getByGoogleSub(profile.sub);
      if (user) await absorbGuest(currentUserId, user);
      else {
        const fields = { kind: 'member' as const, googleSub: profile.sub, email: profile.email, displayName: profile.name || profile.email || 'Google user' };
        const current = currentUserId ? await users.getById(currentUserId) : null;
        user = current?.kind === 'guest' ? await users.update(current.id, fields) : await users.create({ ...fields, role: 'learner' });
        if (!user) throw new AuthError('Could not create the account.');
      }
      await ensureCreator(creators, user);
      return issue(user);
    },

    async getUser(token) {
      const session = await users.getSession(hashToken(token));
      if (!session) return null;
      if (session.expiresAt.getTime() <= clock().getTime()) {
        await users.deleteSession(hashToken(token));
        return null;
      }
      const user = await users.getById(session.userId);
      return user ? publicUser(user) : null;
    },

    async logout(token) {
      await users.deleteSession(hashToken(token));
    },
  };
}
