import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContainer, type Container } from '../container';
import { createApp } from './app';

let c: Container;
let app: ReturnType<typeof createApp>;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vocab-http-'));
  c = createContainer({ dbFile: ':memory:', mediaDir: dir });
  app = createApp(c);
});
afterEach(() => {
  c.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A tiny browser: keeps the session cookie between calls. */
function client() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
}

describe('HTTP: the end-to-end flow', () => {
  it('create deck -> code -> rules -> guest practice -> report', async () => {
    const teacher = client();
    expect((await teacher('POST', '/api/auth/register', { username: 'priya', password: 'secret123' })).status).toBe(200);
    const created = await teacher('POST', '/api/studio/decks', { title: 'Food', targetLang: 'ko', sourceLang: 'en', cardText: '물 | water | mul\n밥 | rice | bap\n책 | book | chaek' });
    expect(created.status).toBe(201);
    const { id, code } = created.json.deck;

    const patched = await teacher('PATCH', `/api/studio/decks/${id}`, { rules: { modes: { listening: false }, writing: { level: 'strict' } }, branding: { title: 'Priya Korean', color: '#7c3aed' } });
    expect(patched.json.deck.ruleOverrides).toEqual({ modes: { listening: false }, writing: { level: 'strict' } });

    // A student with no account opens the code (any case works).
    const student = client();
    const deck = await student('GET', `/api/decks/code/${code.toLowerCase()}`);
    expect(deck.status).toBe(200);
    expect(deck.json.rules.modes.listening).toBe(false);
    expect(deck.json.rules.notInList).toBe(true);
    expect(deck.json.branding).toMatchObject({ title: 'Priya Korean', color: '#7c3aed' });
    expect(deck.json.cards).toHaveLength(3);

    // Answering creates a guest session automatically and saves progress.
    const cardId = deck.json.cards[0].id;
    const ans = await student('POST', '/api/progress', { deckId: id, cardId, skill: 'writing', grade: 3, outcome: 'right', ms: 4000 });
    expect(ans.status).toBe(200);
    expect((await student('GET', '/api/me')).json.user.kind).toBe('guest');
    const prog = await student('GET', `/api/progress/${id}?skill=writing`);
    expect(Object.keys(prog.json.progress)).toEqual([cardId]);

    const report = await student('POST', '/api/reports', { targetType: 'card', targetId: cardId, reason: 'wrong', note: 'typo' });
    expect(report.json).toEqual({ ok: true, status: 'active' });
  });

  it('explains bad and unknown codes', async () => {
    const anon = client();
    expect((await anon('GET', '/api/decks/code/K0RE')).json.error).toMatch(/never use 0/);
    expect((await anon('GET', '/api/decks/code/ZZZZ')).status).toBe(404);
  });

  it('keeps studio and admin routes closed', async () => {
    const anon = client();
    expect((await anon('POST', '/api/studio/decks', { title: 'x', targetLang: 'es', sourceLang: 'en' })).status).toBe(401);
    expect((await anon('GET', '/api/admin/reports')).status).toBe(401);
    await anon('POST', '/api/auth/register', { username: 'norm', password: 'secret123' });
    expect((await anon('GET', '/api/admin/reports')).status).toBe(403);
  });

  it('reads the creator subdomain from the Host header', async () => {
    const anon = client();
    expect((await anon('GET', '/api/config', undefined, { Host: 'ravi.localhost:5173' })).json.tenant).toBe('ravi');
    expect((await anon('GET', '/api/config', undefined, { Host: 'localhost:5173' })).json.tenant).toBeNull();
  });

  it('runs the mock Google sign-in with a state check', async () => {
    const start = await app.request('/api/auth/google/start?next=/studio');
    expect(start.status).toBe(302);
    const stateCookie = start.headers.get('set-cookie')!.split(';')[0];
    const state = decodeURIComponent(stateCookie.split('=')[1]);
    const bad = await app.request('/api/auth/google/mock', { method: 'POST', headers: { Cookie: stateCookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'state=forged&email=a@b.co' });
    expect(bad.status).toBe(400);
    const ok = await app.request('/api/auth/google/mock', {
      method: 'POST',
      headers: { Cookie: stateCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ state, email: 'gita@example.com', name: 'Gita' }).toString(),
    });
    expect(ok.status).toBe(302);
    expect(ok.headers.get('location')).toBe('/studio');
  });
});
