import { createToken, setAuthCookie, verifyPassword } from '@/server/auth'
import { getRequestInfo } from '@/server/lib/request-info'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { logActivity } from '@/server/services/activity-logs'
import { normalizePassword, normalizeUsername } from '@/lib/user-input'
import { db, dbReady } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { isLoginLocked, recordRateEvent } from '@/server/lib/rate-limit'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await dbReady

    const body = await request.json()
    const username = normalizeUsername(body?.username)
    const password = normalizePassword(body?.password)

    if (!username || !password) {
      return jsonError({
        source: request,
        namespace: 'admin.login.errors',
        key: 'emptyCredentials',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }

    // 检查账号是否被锁定
    if (await isLoginLocked(username)) {
      return jsonError({
        source: request,
        namespace: 'admin.login.errors',
        key: 'accountLocked',
        code: 'ACCOUNT_LOCKED',
        status: 429,
      })
    }

    const { ip } = getRequestInfo(request)

    const user = await maybeFirst(
      db.select().from(users).where(eq(users.username, username)).limit(1),
    )
    if (!user) {
      await recordRateEvent('login_fail', username, ip)
      return jsonError({
        source: request,
        namespace: 'admin.login.errors',
        key: 'invalidCredentials',
        code: 'INVALID_CREDENTIALS',
        status: 401,
      })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await recordRateEvent('login_fail', username, ip)
      return jsonError({
        source: request,
        namespace: 'admin.login.errors',
        key: 'invalidCredentials',
        code: 'INVALID_CREDENTIALS',
        status: 401,
      })
    }

    const token = await createToken({
      id: user.id,
      username: user.username,
      role: user.role as 'owner' | 'admin' | 'editor',
    })

    await setAuthCookie(token)

    await logActivity(request, user.id, 'login')

    return jsonSuccess({
      id: user.id,
      username: user.username,
      role: user.role,
    })
  } catch (error) {
    console.error('[POST /api/auth/login] Internal error:', error)
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'internalError',
      code: 'INTERNAL_ERROR',
      status: 500,
    })
  }
}
