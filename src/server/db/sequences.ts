import { db, dbFamily } from '@/server/db'
import { type SQL, sql } from 'drizzle-orm'

const postgresSerialTables = [
  'users',
  'attachments',
  'categories',
  'tags',
  'captchas',
  'guestbook_messages',
  'menus',
  'contents',
  'content_revisions',
  'slug_histories',
  'comments',
  'rate_events',
  'redirect_rules',
] as const

/** PostgreSQL 下显式写入主键后，同步 serial 序列。SQLite 下为 no-op。 */
export async function syncPrimaryKeySequences(executor: unknown = db) {
  if (dbFamily !== 'postgres') return

  const exec = executor as { execute: (query: SQL) => Promise<unknown> }
  for (const tableName of postgresSerialTables) {
    await exec.execute(
      sql.raw(`
      SELECT setval(
        pg_get_serial_sequence('"${tableName}"', 'id'),
        COALESCE((SELECT MAX("id") FROM "${tableName}"), 1),
        COALESCE((SELECT MAX("id") FROM "${tableName}"), 0) > 0
      )
    `),
    )
  }
}
