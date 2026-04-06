import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import fs from 'fs'
import path from 'path'
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

async function createRuntimeDb(): Promise<{
  db: CommonDatabase
  migrate: () => Promise<void>
}> {
  if (dbFamily === 'postgres') {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      throw new Error('DATABASE_URL is required for postgres')
    }

    const { Pool } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { migrate } = await import('drizzle-orm/node-postgres/migrator')

    const pool = new Pool({ connectionString: dbUrl })
    const db = drizzle(pool, { schema: postgresSchema })

    return {
      db: db as unknown as CommonDatabase,
      migrate: () => migrate(db as NodePgDatabase<typeof postgresSchema>, { migrationsFolder }),
    }
  }

  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const { migrate } = await import('drizzle-orm/libsql/migrator')

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

  const db = drizzle(client, { schema: sqliteSchema })

  return {
    db,
    migrate: () => migrate(db, { migrationsFolder }),
  }
}

const runtimePromise = createRuntimeDb()

// 顶层变量，由 initDb 填充
let _db: CommonDatabase

export const dbReady: Promise<void> = runtimePromise.then(async (runtime) => {
  _db = runtime.db
})

/** 执行数据库迁移，仅由 instrumentation.ts 调用 */
export async function runMigrations(): Promise<void> {
  const runtime = await runtimePromise
  await runtime.migrate()
}

/** 获取数据库实例，必须在 dbReady 完成后使用（Next.js instrumentation 已确保） */
export const db: CommonDatabase = new Proxy({} as CommonDatabase, {
  get(_target, prop, receiver) {
    if (!_db) throw new Error('Database not initialized yet. Await dbReady first.')
    return Reflect.get(_db, prop, receiver)
  },
})

export { dbFamily }
