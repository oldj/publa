import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/db/schema/postgres.ts',
  out: './drizzle/postgres',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/blog_web',
  },
})
