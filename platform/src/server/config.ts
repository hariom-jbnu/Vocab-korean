import { resolve } from 'node:path';

// Read .env if there is one (Node 20.12+). Everything has a default, so the file is optional.
try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file: use the defaults below.
}

export interface Config {
  dataDir: string;
  dbFile: string;
  mediaDir: string;
  apiPort: number;
  baseDomain: string;
  googleProvider: 'mock' | 'google';
  production: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = resolve(env.DATA_DIR ?? '.data');
  return {
    dataDir,
    dbFile: resolve(dataDir, 'vocab.db'),
    mediaDir: resolve(dataDir, 'media'),
    apiPort: Number(env.API_PORT ?? env.PORT ?? 8787),
    baseDomain: env.BASE_DOMAIN ?? 'localhost',
    googleProvider: env.GOOGLE_PROVIDER === 'google' ? 'google' : 'mock',
    production: env.NODE_ENV === 'production',
  };
}
