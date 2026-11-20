import type { Settings } from '../types';
import type { ReviewRecord, WordCard } from './srs';

/**
 * Progress backups: a JSON file holding settings, every card's FSRS state
 * and the full review log. It works without accounts and lets a learner
 * move their progress to another browser.
 */
export const BACKUP_APP = 'vocab-korean';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  settings?: Partial<Settings>;
  cards: WordCard[];
  reviews: ReviewRecord[];
}

export function createBackup(cards: Iterable<WordCard>, reviews: readonly ReviewRecord[], settings: Settings): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    cards: [...cards],
    reviews: reviews.map(({ id: _id, ...r }) => r),
  };
}

export function backupFileName(now = new Date()): string {
  return `vocab-korean-backup-${now.toISOString().slice(0, 10)}.json`;
}

const toDate = (v: unknown, field: string): Date => {
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date in ${field}`);
  return d;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Read and check a backup file, turning date strings back into dates. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !Array.isArray(raw.cards) || !Array.isArray(raw.reviews)) {
    throw new Error('This file is not a Vocab Korean backup.');
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }

  const cards = raw.cards.map((c, i): WordCard => {
    if (!isObj(c) || typeof c.id !== 'string') throw new Error(`Card ${i + 1} is missing its word.`);
    return {
      ...(c as unknown as WordCard),
      due: toDate(c.due, `card ${c.id}`),
      ...(c.last_review ? { last_review: toDate(c.last_review, `card ${c.id}`) } : {}),
    };
  });

  const reviews = raw.reviews.map((r, i): ReviewRecord => {
    if (!isObj(r) || typeof r.wordId !== 'string') throw new Error(`Review ${i + 1} is missing its word.`);
    const { id: _id, ...rest } = r as unknown as ReviewRecord;
    return { ...rest, review: toDate(r.review, `review ${i + 1}`), due: toDate(r.due, `review ${i + 1}`) };
  });

  return {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: String(raw.exportedAt ?? ''),
    settings: isObj(raw.settings) ? (raw.settings as Partial<Settings>) : undefined,
    cards,
    reviews,
  };
}
