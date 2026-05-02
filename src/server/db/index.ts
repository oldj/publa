import { createClient } from '@libsql/client'
import { drizzle as drizzleLibsql, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { getDatabaseFamily } from './family'
import { postgresSchema } from './schema/postgres'
import { sqliteSchema } from './schema/sqlite'

const dbFamily = getDatabaseFamily()
const migrationsFolder = path.join(
  process.cwd(),
  'drizzle',
  dbFamily === 'postgres' ? 'postgres' : 'sqlite',
)

type CommonDatabase = LibSQLDatabase<typeof sqliteSchema>

// 同步构造 db 与 migrate；底层构造函数不会建立网络连接，连接是 lazy 的
function buildDb(): { db: CommonDatabase; migrate: () => Promise<void> } {
  if (dbFamily === 'postgres') {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL is required for postgres')
    }

    const pool = new Pool({ connectionString: dbUrl })
    const db = drizzlePg(pool, { schema: postgresSchema })

    return {
      db: db as unknown as CommonDatabase,
      migrate: () => migratePg(db as NodePgDatabase<typeof postgresSchema>, { migrationsFolder }),
    }
  }

  const sqliteDbUrl =
    process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'data', 'publa.db')}`

  // 确保数据库文件所在目录存在
  if (sqliteDbUrl.startsWith('file:')) {
    const dbDir = path.dirname(sqliteDbUrl.slice(5))
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const client = createClient({
    url: sqliteDbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  const db = drizzleLibsql(client, { schema: sqliteSchema })

  return {
    db,
    migrate: () => migrateLibsql(db, { migrationsFolder }),
  }
}

const runtime = buildDb()

export const db: CommonDatabase = runtime.db

/** 执行数据库迁移，仅由 instrumentation.ts 调用 */
export async function runMigrations(): Promise<void> {
  await runtime.migrate()
}

export { dbFamily }
