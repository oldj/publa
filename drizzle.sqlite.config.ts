import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/db/schema/sqlite.ts',
  out: './drizzle/sqlite',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./data/publa.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
})
