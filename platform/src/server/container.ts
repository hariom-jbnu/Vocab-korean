/**
 * The one place that picks adapters for the ports.
 *
 * Going to production means changing this file only: for example
 *   decks: postgresDeckStore(pool)      instead of sqliteDeckStore(db)
 *   media: s3MediaStore(bucket)         instead of localMediaStore(db, dir)
 *   google: realGoogleProvider(id, key) instead of mockGoogleProvider()
 * Services, routes and the website stay as they are.
 */
import { openDatabase } from './adapters/sqlite/db';
import { sqliteCreatorStore, sqliteDeckStore, sqliteProgressStore, sqliteRateLimiter, sqliteReportStore, sqliteUserStore } from './adapters/sqlite/stores';
import { localMediaStore, mockGoogleProvider } from './adapters/local';
import { createAuthService } from './services/auth';
import { createDeckService } from './services/decks';
import { createModerationService } from './services/moderation';
import { createProgressService } from './services/progress';
import type { GoogleProvider } from './ports';

export interface ContainerOptions {
  dbFile: string;
  mediaDir: string;
  baseDomain?: string;
  google?: GoogleProvider;
}

export function createContainer(opts: ContainerOptions) {
  const { db, close } = openDatabase(opts.dbFile);

  const stores = {
    decks: sqliteDeckStore(db),
    creators: sqliteCreatorStore(db),
    users: sqliteUserStore(db),
    progress: sqliteProgressStore(db),
    reports: sqliteReportStore(db),
  };
  const limiter = sqliteRateLimiter(db);
  const media = localMediaStore(db, opts.mediaDir);
  const google = opts.google ?? mockGoogleProvider();

  return {
    db,
    close,
    stores,
    media,
    limiter,
    google,
    baseDomain: opts.baseDomain ?? 'localhost',
    auth: createAuthService(stores.users, stores.creators),
    decks: createDeckService({ decks: stores.decks, creators: stores.creators, limiter }),
    moderation: createModerationService({ decks: stores.decks, creators: stores.creators, reports: stores.reports, limiter }),
    progress: createProgressService({ decks: stores.decks, progress: stores.progress }),
  };
}

export type Container = ReturnType<typeof createContainer>;
