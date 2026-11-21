/**
 * Local adapters that need no cloud account: uploaded files in a folder,
 * and a pretend Google sign-in page.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import type { GoogleProvider, MediaStore } from '../ports';
import type { Db } from './sqlite/db';
import * as t from './sqlite/schema';

export const MEDIA_TYPES: Record<string, { ext: string; maxBytes: number }> = {
  'image/png': { ext: 'png', maxBytes: 2_000_000 },
  'image/jpeg': { ext: 'jpg', maxBytes: 2_000_000 },
  'image/webp': { ext: 'webp', maxBytes: 2_000_000 },
  'image/gif': { ext: 'gif', maxBytes: 2_000_000 },
  'audio/mpeg': { ext: 'mp3', maxBytes: 5_000_000 },
  'audio/mp4': { ext: 'm4a', maxBytes: 5_000_000 },
  'audio/ogg': { ext: 'ogg', maxBytes: 5_000_000 },
  'audio/webm': { ext: 'webm', maxBytes: 5_000_000 },
  'audio/wav': { ext: 'wav', maxBytes: 5_000_000 },
};

export class MediaRejectedError extends Error {}

/**
 * Files live in <dir>/<id>.<ext>; the media table keeps who uploaded what.
 * A cloud version (S3, R2, Supabase Storage) implements the same three calls.
 */
export function localMediaStore(db: Db, dir: string): MediaStore {
  return {
    async put({ bytes, mime, ownerId }) {
      const type = MEDIA_TYPES[mime];
      if (!type) throw new MediaRejectedError(`Files of type ${mime || 'unknown'} are not allowed.`);
      if (bytes.byteLength > type.maxBytes) throw new MediaRejectedError(`File is too big (max ${type.maxBytes / 1_000_000} MB).`);
      const id = `${randomUUID()}.${type.ext}`;
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, id), bytes);
      db.insert(t.media).values({ id, ownerId, mime, size: bytes.byteLength, path: id, createdAt: new Date().toISOString() }).run();
      return { id, mime, size: bytes.byteLength, url: `/media/${id}` };
    },
    async get(id) {
      const row = db.select().from(t.media).where(eq(t.media.id, id)).get();
      if (!row) return null;
      try {
        return { bytes: await readFile(join(dir, row.path)), mime: row.mime };
      } catch {
        return null;
      }
    },
    async remove(id) {
      const row = db.select().from(t.media).where(eq(t.media.id, id)).get();
      if (!row) return;
      await rm(join(dir, row.path), { force: true });
      db.delete(t.media).where(eq(t.media.id, id)).run();
    },
  };
}

/**
 * Pretend Google for local testing: /api/auth/google/start sends the browser
 * to a small form on this server where you type any name and email. The
 * profile id is derived from the email, so the same email signs in to the
 * same account every time.
 */
export function mockGoogleProvider(): GoogleProvider {
  return {
    kind: 'mock',
    authorizeUrl: (state) => `/api/auth/google/mock?state=${encodeURIComponent(state)}`,
    async exchange(params) {
      const email = (params.email ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter an email address.');
      return { sub: `mock:${email}`, email, name: (params.name ?? '').trim() || email.split('@')[0] };
    },
  };
}
