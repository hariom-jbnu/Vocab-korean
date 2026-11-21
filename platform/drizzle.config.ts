import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations in ./drizzle from the schema. The app applies them on start.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/adapters/sqlite/schema.ts',
  out: './drizzle',
});
