/**
 * HTTP API (Hono). Routes only parse input, call a service and shape the
 * answer; the rules live in services/ and core/.
 */
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { codeProblem, normalizeCode } from '../../core/code';
import { slugFromHost } from '../../core/tenant';
import { MODERATION_STATUSES, REPORT_REASONS, SKILL_MODES, type ModerationStatus, type ReportReason, type SkillMode, type User } from '../../core/types';
import type { Container } from '../container';
import { AuthError } from '../services/auth';
import { DeckError, parseOrThrow } from '../services/decks';
import { ModerationError } from '../services/moderation';
import { MediaRejectedError } from '../adapters/local';

export const SESSION_COOKIE = 'vp_session';
const STATE_COOKIE = 'vp_oauth_state';

type Env = { Variables: { user: User | null } };

export interface AppOptions {
  /** Mark cookies Secure (set when serving over https in production). */
  secureCookies?: boolean;
}

export function createApp(c: Container, opts: AppOptions = {}) {
  const app = new Hono<Env>();

  const setSession = (ctx: Context<Env>, token: string, expiresAt: Date) =>
    setCookie(ctx, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', expires: expiresAt, secure: !!opts.secureCookies });

  /** Address of the caller, for rate limits. Behind a proxy, x-forwarded-for carries it. */
  const clientKey = (ctx: Context<Env>) => ctx.req.header('x-forwarded-for')?.split(',')[0].trim() || ctx.req.header('x-real-ip') || 'local';

  /** The signed-in user, or a new guest so learners never hit a sign-up wall. */
  async function userOrGuest(ctx: Context<Env>): Promise<User> {
    const user = ctx.get('user');
    if (user) return user;
    const s = await c.auth.startGuest();
    setSession(ctx, s.token, s.expiresAt);
    ctx.set('user', s.user);
    return s.user;
  }

  function member(ctx: Context<Env>): User {
    const user = ctx.get('user');
    if (!user || user.kind !== 'member') throw new HTTPException(401, { message: 'Sign in first.' });
    return user;
  }

  function admin(ctx: Context<Env>): User {
    const user = member(ctx);
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admins only.' });
    return user;
  }

  app.onError((err, ctx) => {
    if (err instanceof HTTPException) return ctx.json({ error: err.message }, err.status);
    if (err instanceof DeckError || err instanceof AuthError || err instanceof ModerationError) {
      if (err instanceof DeckError && err.retryAfterMs) ctx.header('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
      return ctx.json({ error: err.message }, err.status);
    }
    if (err instanceof MediaRejectedError) return ctx.json({ error: err.message }, 400);
    console.error(err);
    return ctx.json({ error: 'Something went wrong on the server.' }, 500);
  });

  // Load the user behind the session cookie on every API call.
  app.use('/api/*', async (ctx, next) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    ctx.set('user', token ? await c.auth.getUser(token) : null);
    await next();
  });

  app.get('/api/health', (ctx) => ctx.json({ ok: true }));

  /** Settings the website needs, plus the creator subdomain this request came in on. */
  app.get('/api/config', (ctx) =>
    ctx.json({ baseDomain: c.baseDomain, google: c.google.kind, tenant: slugFromHost(ctx.req.header('host') ?? '', c.baseDomain) })
  );

  /* ---------------- Auth ---------------- */

  app.get('/api/me', async (ctx) => {
    const user = ctx.get('user');
    const creator = user && user.kind === 'member' ? await c.stores.creators.getByOwner(user.id) : null;
    return ctx.json({ user, creator });
  });

  app.post('/api/auth/guest', async (ctx) => {
    const user = await userOrGuest(ctx);
    return ctx.json({ user });
  });

  const credentials = z.object({ username: z.string().max(64), password: z.string().max(200), displayName: z.string().max(60).optional() });

  app.post('/api/auth/register', async (ctx) => {
    const limit = await c.limiter.hit(`register:${clientKey(ctx)}`, 20, 60 * 60 * 1000);
    if (!limit.ok) throw new HTTPException(429, { message: 'Too many sign-ups from here. Try again later.' });
    const body = parseOrThrow(credentials, await ctx.req.json().catch(() => ({})));
    const s = await c.auth.register(body, ctx.get('user')?.id);
    setSession(ctx, s.token, s.expiresAt);
    return ctx.json({ user: s.user });
  });

  app.post('/api/auth/login', async (ctx) => {
    const limit = await c.limiter.hit(`login:${clientKey(ctx)}`, 30, 15 * 60 * 1000);
    if (!limit.ok) throw new HTTPException(429, { message: 'Too many tries. Wait a few minutes.' });
    const body = parseOrThrow(credentials, await ctx.req.json().catch(() => ({})));
    const s = await c.auth.login(body, ctx.get('user')?.id);
    setSession(ctx, s.token, s.expiresAt);
    return ctx.json({ user: s.user });
  });

  app.post('/api/auth/logout', async (ctx) => {
    const token = getCookie(ctx, SESSION_COOKIE);
    if (token) await c.auth.logout(token);
    deleteCookie(ctx, SESSION_COOKIE, { path: '/' });
    return ctx.json({ ok: true });
  });

  const safeNext = (next: string | undefined) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/studio');

  app.get('/api/auth/google/start', (ctx) => {
    const state = `${randomBytes(16).toString('base64url')}.${encodeURIComponent(safeNext(ctx.req.query('next')))}`;
    setCookie(ctx, STATE_COOKIE, state, { httpOnly: true, sameSite: 'Lax', path: '/api/auth/google', maxAge: 600, secure: !!opts.secureCookies });
    return ctx.redirect(c.google.authorizeUrl(state));
  });

  async function finishGoogle(ctx: Context<Env>, params: Record<string, string>) {
    const expected = getCookie(ctx, STATE_COOKIE);
    if (!expected || params.state !== expected) throw new HTTPException(400, { message: 'Sign-in expired. Start again.' });
    deleteCookie(ctx, STATE_COOKIE, { path: '/api/auth/google' });
    const profile = await c.google.exchange(params).catch((e: Error) => {
      throw new HTTPException(400, { message: e.message });
    });
    const s = await c.auth.signInWithGoogle(profile, ctx.get('user')?.id);
    setSession(ctx, s.token, s.expiresAt);
    return ctx.redirect(safeNext(decodeURIComponent(expected.split('.')[1] ?? '')));
  }

  app.get('/api/auth/google/callback', (ctx) => finishGoogle(ctx, ctx.req.query()));

  // The pretend Google page, only when the mock provider is on.
  app.get('/api/auth/google/mock', (ctx) => {
    if (c.google.kind !== 'mock') return ctx.notFound();
    const state = ctx.req.query('state') ?? '';
    const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    return ctx.html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pretend Google sign-in</title>
<style>body{font-family:system-ui,sans-serif;background:#f1f5f9;display:grid;place-items:center;min-height:100vh;margin:0}form{background:#fff;padding:24px;border-radius:12px;box-shadow:0 1px 4px #0002;width:min(360px,90vw)}label{display:block;margin:12px 0 4px;font-size:14px}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px}button{margin-top:16px;width:100%;padding:10px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:16px}p{color:#475569;font-size:13px}</style></head>
<body><form method="post"><h2 style="margin:0">Pretend Google</h2><p>Local test only. No real Google account is used. The same email always signs in to the same account.</p>
<input type="hidden" name="state" value="${esc(state)}"><label>Name</label><input name="name" placeholder="Priya Teacher"><label>Email</label><input name="email" type="email" required placeholder="priya@example.com">
<button>Continue</button></form></body></html>`);
  });

  app.post('/api/auth/google/mock', async (ctx) => {
    if (c.google.kind !== 'mock') return ctx.notFound();
    const form = await ctx.req.parseBody();
    return finishGoogle(ctx, { state: String(form.state ?? ''), email: String(form.email ?? ''), name: String(form.name ?? '') });
  });

  /* ---------------- Practice (guests welcome) ---------------- */

  app.get('/api/decks/code/:code', async (ctx) => {
    const raw = ctx.req.param('code');
    const problem = codeProblem(raw);
    if (problem) return ctx.json({ error: problem }, 400);
    return ctx.json(await c.decks.getForPractice(normalizeCode(raw)));
  });

  app.get('/api/creators/:slug', async (ctx) => ctx.json(await c.decks.getCreatorPage(ctx.req.param('slug').toLowerCase())));

  app.get('/api/progress/:deckId', async (ctx) => {
    const user = await userOrGuest(ctx);
    const skill = ctx.req.query('skill') as SkillMode;
    if (!SKILL_MODES.includes(skill)) return ctx.json({ error: 'Unknown skill.' }, 400);
    return ctx.json({ progress: await c.progress.load(user, ctx.req.param('deckId'), skill), stats: await c.progress.stats(user, ctx.req.param('deckId')) });
  });

  app.post('/api/progress', async (ctx) => {
    const user = await userOrGuest(ctx);
    const state = await c.progress.record(user, await ctx.req.json().catch(() => ({})));
    return ctx.json({ state });
  });

  app.post('/api/reports', async (ctx) => {
    const user = await userOrGuest(ctx);
    const body = parseOrThrow(
      z.object({
        targetType: z.enum(['deck', 'card']),
        targetId: z.string(),
        reason: z.enum(REPORT_REASONS as [ReportReason, ...ReportReason[]]),
        note: z.string().max(500).optional(),
      }),
      await ctx.req.json().catch(() => ({}))
    );
    const r = await c.moderation.report({ ...body, reporterId: user.id, reporterKey: `${user.id}:${clientKey(ctx)}` });
    return ctx.json({ ok: true, status: r.status });
  });

  /* ---------------- Studio (creators) ---------------- */

  app.get('/api/studio/decks', async (ctx) => ctx.json(await c.decks.listMine(member(ctx))));

  app.post('/api/studio/decks', async (ctx) => {
    const deck = await c.decks.create(member(ctx), await ctx.req.json().catch(() => ({})), clientKey(ctx));
    return ctx.json({ deck }, 201);
  });

  app.get('/api/studio/decks/:id', async (ctx) => ctx.json(await c.decks.getForOwner(member(ctx), ctx.req.param('id'))));

  app.patch('/api/studio/decks/:id', async (ctx) => ctx.json({ deck: await c.decks.update(member(ctx), ctx.req.param('id'), await ctx.req.json().catch(() => ({}))) }));

  app.delete('/api/studio/decks/:id', async (ctx) => {
    await c.decks.remove(member(ctx), ctx.req.param('id'));
    return ctx.json({ ok: true });
  });

  app.put('/api/studio/decks/:id/cards', async (ctx) => {
    const body = parseOrThrow(z.object({ text: z.string().max(200_000) }), await ctx.req.json().catch(() => ({})));
    return ctx.json({ cards: await c.decks.saveCardText(member(ctx), ctx.req.param('id'), body.text) });
  });

  app.put('/api/studio/decks/:id/cards/:cardId/audio', async (ctx) => {
    const body = parseOrThrow(z.object({ mediaId: z.string().nullable() }), await ctx.req.json().catch(() => ({})));
    return ctx.json({ cards: await c.decks.setCardAudio(member(ctx), ctx.req.param('id'), ctx.req.param('cardId'), body.mediaId ?? undefined) });
  });

  app.patch('/api/studio/creator', async (ctx) => ctx.json({ creator: await c.decks.updateCreator(member(ctx), await ctx.req.json().catch(() => ({}))) }));

  /* ---------------- Media ---------------- */

  app.post('/api/media', async (ctx) => {
    const user = member(ctx);
    const limit = await c.limiter.hit(`media:${user.id}`, 60, 60 * 60 * 1000);
    if (!limit.ok) throw new HTTPException(429, { message: 'Too many uploads. Try again later.' });
    const form = await ctx.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return ctx.json({ error: 'Choose a file.' }, 400);
    const stored = await c.media.put({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, ownerId: user.id });
    return ctx.json(stored, 201);
  });

  app.get('/media/:id', async (ctx) => {
    const file = await c.media.get(ctx.req.param('id'));
    if (!file) return ctx.notFound();
    return ctx.body(file.bytes as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': file.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  /* ---------------- Moderation (admins) ---------------- */

  app.get('/api/admin/reports', async (ctx) => {
    admin(ctx);
    return ctx.json({ reports: await c.moderation.queue() });
  });

  app.post('/api/admin/status', async (ctx) => {
    admin(ctx);
    const body = parseOrThrow(
      z.object({ targetType: z.enum(['deck', 'card']), targetId: z.string(), status: z.enum(MODERATION_STATUSES as [ModerationStatus, ...ModerationStatus[]]) }),
      await ctx.req.json().catch(() => ({}))
    );
    await c.moderation.setStatus(body.targetType, body.targetId, body.status);
    return ctx.json({ ok: true });
  });

  app.all('/api/*', (ctx) => ctx.json({ error: 'Not found.' }, 404));

  return app;
}
