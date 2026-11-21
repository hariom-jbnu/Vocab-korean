/**
 * Creator slugs and subdomain-style routing.
 *
 * Today a creator page answers on two kinds of address:
 *   http://localhost:5173/@ravi       (path)
 *   http://ravi.localhost:5173/       (subdomain; *.localhost reaches this machine in modern browsers)
 * In production the same function reads ravi.vocab.example.com, and a custom
 * domain can map to a slug with one more lookup before this one.
 */
import { isValidCode, normalizeCode } from './code';

/** Slugs that would clash with app routes or common subdomains. */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'blog', 'cdn', 'dashboard', 'dev', 'docs', 'help', 'home',
  'login', 'logout', 'mail', 'media', 'new', 'p', 'register', 'settings', 'signup', 'static', 'status',
  'studio', 'support', 'test', 'vocab', 'www',
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/** Lowercase letters, digits and single hyphens, e.g. "Ravi Sharma!" -> "ravi-sharma". */
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug);
}

/**
 * The creator slug in a host name, or null for the main site.
 * slugFromHost('ravi.localhost:5173', 'localhost') -> 'ravi'
 * slugFromHost('localhost:5173', 'localhost') -> null
 */
export function slugFromHost(host: string, baseDomain: string): string | null {
  const name = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  const base = baseDomain.toLowerCase().replace(/^\./, '');
  if (name === base || !name.endsWith(`.${base}`)) return null;
  const sub = name.slice(0, -(base.length + 1));
  if (sub.includes('.') || !isValidSlug(sub)) return null;
  return sub;
}

export type Route =
  | { kind: 'creator'; slug: string }
  | { kind: 'deck'; code: string }
  | { kind: 'app' };

/**
 * What an address points at:
 * - ravi.localhost/ or /@ravi -> the creator page
 * - /A7K9 (any case) or /p/A7K9 -> practice that deck
 * - anything else -> a normal app page
 */
export function resolveRoute(host: string, pathname: string, baseDomain: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const sub = slugFromHost(host, baseDomain);
  if (sub && path === '/') return { kind: 'creator', slug: sub };
  const at = /^\/@([^/]+)$/.exec(path);
  if (at) {
    const slug = at[1].toLowerCase();
    if (isValidSlug(slug)) return { kind: 'creator', slug };
  }
  const code = /^\/(?:p\/)?([^/]+)$/.exec(path);
  if (code) {
    const c = normalizeCode(code[1]);
    if (isValidCode(c) && (path.startsWith('/p/') || /^[A-Za-z0-9]{4}$/.test(code[1]))) return { kind: 'deck', code: c };
  }
  return { kind: 'app' };
}
