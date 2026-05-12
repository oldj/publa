import { normalizePassword } from '@/lib/user-input'
import {
  createReauthToken,
  requireCurrentUser,
  requireRecentReauth,
  setReauthCookie,
  verifyPassword,
} from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import {
  clearReauthFailures,
  enforceReauthRateLimit,
  recordReauthFailure,
} from '@/server/lib/rate-limit'
import { safeParseJson } from '@/server/lib/request'
import { getRequestInfo } from '@/server/lib/request-info'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const reauth = await requireRecentReauth(guard.user, request)
  if (!reauth.ok) return reauth.response

  return jsonSuccess()
}

export async function POST(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const password = normalizePassword(body?.password)
  if (!password) {
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'invalidPassword',
      code: 'INVALID_PASSWORD',
      status: 401,
    })
  }

  const { ip } = getRequestInfo(request)
  if ((await enforceReauthRateLimit(guard.user.username, ip)).locked) {
    return jsonError({
      source: request,
      namespace: 'admin.login.errors',
      key: 'accountLocked',
      code: 'ACCOUNT_LOCKED',
      status: 429,
    })
  }

  const row = await maybeFirst(
    db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, guard.user.id))
      .limit(1),
  )

  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    await recordReauthFailure(guard.user.username, ip)
    return jsonError({
      source: request,
      namespace: 'common.api',
      key: 'invalidPassword',
      code: 'INVALID_PASSWORD',
      status: 401,
    })
  }

  await clearReauthFailures(guard.user.username)
  const token = await createReauthToken(guard.user)
  await setReauthCookie(token)

  return jsonSuccess()
}
