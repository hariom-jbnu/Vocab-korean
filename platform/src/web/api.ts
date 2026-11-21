/** Small typed client for the local API. */
import type { Branding, Card, Creator, Deck, DeckRules, ModerationStatus, PracticeDeck, Report, ReportReason, SkillMode, User } from '../core/types';
import type { SrsState } from '../core/srs';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export type StudioDeck = Deck & { cardCount: number };
export type CreatorPageData = {
  creator: { slug: string; displayName: string; branding: Branding };
  decks: { code: string; title: string; description: string; targetLang: string; sourceLang: string; moderationStatus: ModerationStatus; cardCount: number }[];
};
export type QueueItem = Report & { targetTitle: string; deckCode?: string; targetStatus: ModerationStatus };

export const api = {
  config: () => call<{ baseDomain: string; google: 'mock' | 'google'; tenant: string | null }>('GET', '/api/config'),
  me: () => call<{ user: User | null; creator: Creator | null }>('GET', '/api/me'),
  guest: () => call<{ user: User }>('POST', '/api/auth/guest'),
  register: (b: { username: string; password: string; displayName?: string }) => call<{ user: User }>('POST', '/api/auth/register', b),
  login: (b: { username: string; password: string }) => call<{ user: User }>('POST', '/api/auth/login', b),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),

  deckByCode: (code: string) => call<PracticeDeck>('GET', `/api/decks/code/${encodeURIComponent(code)}`),
  creatorPage: (slug: string) => call<CreatorPageData>('GET', `/api/creators/${encodeURIComponent(slug)}`),
  progress: (deckId: string, skill: SkillMode) =>
    call<{ progress: Record<string, SrsState>; stats: Record<SkillMode, { studied: number; answers: number }> }>('GET', `/api/progress/${deckId}?skill=${skill}`),
  answer: (b: { deckId: string; cardId: string; skill: SkillMode; grade: number; outcome: string; ms?: number }) => call<{ state: SrsState }>('POST', '/api/progress', b),
  report: (b: { targetType: 'deck' | 'card'; targetId: string; reason: ReportReason; note?: string }) => call<{ ok: true; status: ModerationStatus }>('POST', '/api/reports', b),

  myDecks: () => call<{ creator: Creator; decks: StudioDeck[] }>('GET', '/api/studio/decks'),
  createDeck: (b: unknown) => call<{ deck: Deck }>('POST', '/api/studio/decks', b),
  studioDeck: (id: string) => call<{ deck: Deck; rules: DeckRules; creator: Creator; cards: Card[] }>('GET', `/api/studio/decks/${id}`),
  updateDeck: (id: string, b: unknown) => call<{ deck: Deck }>('PATCH', `/api/studio/decks/${id}`, b),
  deleteDeck: (id: string) => call<{ ok: true }>('DELETE', `/api/studio/decks/${id}`),
  saveCards: (id: string, text: string) => call<{ cards: Card[] }>('PUT', `/api/studio/decks/${id}/cards`, { text }),
  setCardAudio: (id: string, cardId: string, mediaId: string | null) => call<{ cards: Card[] }>('PUT', `/api/studio/decks/${id}/cards/${cardId}/audio`, { mediaId }),
  updateCreator: (b: { displayName?: string; branding?: Branding }) => call<{ creator: Creator }>('PATCH', '/api/studio/creator', b),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return call<{ id: string; url: string; mime: string; size: number }>('POST', '/api/media', fd);
  },

  reports: () => call<{ reports: QueueItem[] }>('GET', '/api/admin/reports'),
  setStatus: (b: { targetType: 'deck' | 'card'; targetId: string; status: ModerationStatus }) => call<{ ok: true }>('POST', '/api/admin/status', b),
};

export const mediaUrl = (id?: string) => (id ? `/media/${id}` : undefined);

export const LANGUAGES: Record<string, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', en: 'English', es: 'Spanish', fr: 'French', hi: 'Hindi', id: 'Indonesian', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', mr: 'Marathi', ne: 'Nepali', pt: 'Portuguese', ru: 'Russian', ta: 'Tamil', th: 'Thai', tr: 'Turkish',
  uk: 'Ukrainian', ur: 'Urdu', vi: 'Vietnamese', zh: 'Chinese',
};
export const langName = (code?: string) => (code ? (LANGUAGES[code.split('-')[0]] ?? code) : '');
