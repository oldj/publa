/**
 * 测试用数据库初始化
 * 使用真实的 drizzle 迁移脚本创建表，确保与 schema 保持同步
 */
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import path from 'path'
import { vi } from 'vitest'
import { sqliteSchema } from '@/server/db/schema/sqlite'

const client = createClient({ url: 'file::memory:?cache=shared' })
export const testDb = drizzle(client, { schema: sqliteSchema })

const resetTableNames = [
  'content_revisions',
  'content_tags',
  'slug_histories',
  'comments',
  'email_logs',
  'guestbook_messages',
  'contents',
  'categories',
  'tags',
  'menus',
  'redirect_rules',
  'settings',
  'attachments',
  'captchas',
  'rate_events',
  'users',
  '__drizzle_migrations',
] as const

// Mock db 模块，使用测试数据库
vi.mock('@/server/db', () => ({
  db: testDb,
  dbFamily: 'sqlite',
  dbReady: Promise.resolve(),
}))

/** 执行迁移并插入基础测试数据 */
export async function setupTestDb() {
  await testDb.run(sql.raw('PRAGMA foreign_keys = OFF'))
  for (const tableName of resetTableNames) {
    await testDb.run(sql.raw(`DROP TABLE IF EXISTS "${tableName}"`))
  }
  await testDb.run(sql.raw('PRAGMA foreign_keys = ON'))

  // 使用真实迁移脚本建表
  await migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle', 'sqlite') })

  // 插入测试用户
  await testDb.insert(sqliteSchema.users).values([
    { id: 1, username: 'admin', passwordHash: 'hash', role: 'owner' },
    { id: 2, username: 'editor', passwordHash: 'hash', role: 'editor' },
  ])
}
