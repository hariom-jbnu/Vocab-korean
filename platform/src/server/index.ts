/**
 * Start the API server. In production mode it also serves the built website
 * from dist/web, so one process runs everything.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { loadConfig } from './config';
import { createContainer } from './container';
import { createApp } from './http/app';

const config = loadConfig();
const container = createContainer({ dbFile: config.dbFile, mediaDir: config.mediaDir, baseDomain: config.baseDomain });
if (config.googleProvider === 'google') console.warn('GOOGLE_PROVIDER=google: the real Google adapter is not built yet, so the local pretend-Google page is used.');
const app = createApp(container);

if (config.production) {
  const index = 'dist/web/index.html';
  if (!existsSync(index)) {
    console.error('No built website found. Run "npm run build" first.');
    process.exit(1);
  }
  app.use('/assets/*', serveStatic({ root: './dist/web' }));
  app.use('*', serveStatic({ root: './dist/web' }));
  // Any other page is handled by the website's router.
  const html = readFileSync(index, 'utf8');
  app.get('*', (c) => c.html(html));
}

serve({ fetch: app.fetch, port: config.apiPort, hostname: '0.0.0.0' }, ({ port }) => {
  console.log(`API ready on http://localhost:${port}  (data in ${config.dataDir})`);
  if (config.production) console.log(`Open http://localhost:${port}`);
});

const stop = () => {
  container.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
