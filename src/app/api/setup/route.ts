import { DEFAULT_LOCALE, isLocale } from '@/i18n/locales'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { createToken, hashPassword, setAuthCookie } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { db, dbReady } from '@/server/db'
import { insertOne, maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { seed } from '@/server/db/seed'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await dbReady

    // 检查是否已经初始化
    const existingOwner = await maybeFirst(
      db.select().from(users).where(eq(users.role, 'owner')).limit(1),
    )
    if (existingOwner) {
      return jsonError({
        source: request,
        namespace: 'admin.setup.errors',
        key: 'alreadyInitialized',
        code: 'ALREADY_INITIALIZED',
        status: 403,
      })
    }

    const body = await request.json()
    const username = normalizeUsername(body?.username)
    const password = normalizePassword(body?.password)
    const email = normalizeEmail(body?.email)
    const language = isLocale(body?.language) ? body.language : DEFAULT_LOCALE

    if (!username || !password) {
      return jsonError({
        source: request,
        namespace: 'admin.setup.errors',
        key: 'usernameOrPasswordEmpty',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }

    if (password.length < 6) {
      return jsonError({
        source: request,
        namespace: 'admin.setup.errors',
        key: 'passwordTooShort',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }

    const passwordHash = await hashPassword(password)

    const owner = await db.transaction(async (tx) => {
      const owner = await insertOne(
        tx
          .insert(users)
          .values({
            username,
            email,
            passwordHash,
            role: 'owner',
          })
          .returning(),
      )

      // 填充默认数据（把初始化时选中的界面语言写入 settings.language）
      await seed(tx, { language })

      return owner
    })

    // 自动登录
    const token = await createToken({
      id: owner.id,
      username: owner.username,
      role: 'owner',
    })
    await setAuthCookie(token)

    return jsonSuccess({
      id: owner.id,
      username: owner.username,
      role: owner.role,
    })
  } catch (error) {
    console.error('[POST /api/setup] Internal error:', error)
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'internalError',
      code: 'INTERNAL_ERROR',
      status: 500,
    })
  }
}
