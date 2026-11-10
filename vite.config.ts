import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Files in public/ that the app needs offline. */
const PUBLIC_FILES = ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

/**
 * Writes sw.js at build time: the template in src/sw.js plus the list of
 * built files to save for offline use. The version is a hash of that list,
 * so every release with new files gets a fresh cache.
 */
function offline(): Plugin {
  return {
    name: 'vocab-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'));
      const precache = ['./', 'index.html', ...PUBLIC_FILES, ...built.filter((f) => f !== 'index.html')].sort();
      const template = readFileSync(path.resolve(__dirname, 'src/sw.js'), 'utf8');
      const version = createHash('sha256').update(precache.join('\n')).update(template).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', () => version).replace('__PRECACHE__', () => JSON.stringify(precache, null, 2)),
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any folder on static hosting.
  base: './',
  // Besides VITE_ variables, read the public Supabase settings that the
  // Supabase integration on Vercel adds to a project. Only these public
  // values reach the browser; secret keys have no matching prefix.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_SUPABASE_'],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss(), offline()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
