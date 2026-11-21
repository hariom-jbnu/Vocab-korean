/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/web', emptyOutDir: true },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    // Creator pages also answer on <slug>.localhost (subdomain-style routing).
    allowedHosts: ['.localhost'],
    proxy: {
      // The Host header is kept, so the API can see the creator subdomain too.
      '/api': { target: API },
      '/media': { target: API },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
