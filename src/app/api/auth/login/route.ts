import { normalizePassword, normalizeUsername } from '@/lib/user-input'
import { createToken, hashPassword, setAuthCookie, verifyPassword } from '@/server/auth'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import {
  clearLoginFailures,
  enforceLoginRateLimit,
  recordLoginFailure,
} from '@/server/lib/rate-limit'
import { getRequestInfo } from '@/server/lib/request-info'
import { logActivity } from '@/server/services/activity-logs'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'

// 预生成一个 dummy hash，用户不存在时仍跑一次 bcrypt 比对，
// 避免「存在 vs 不存在」的响应时间差被用于枚举用户名。
// 用 Promise 包裹以便模块首次加载时异步初始化，不阻塞启动。
const dummyBcryptHashPromise: Promise<string> = hashPassword(
  // 随机明文；无人能登上，仅用于消耗 bcrypt CPU
  `dummy:${Math.random().toString(36).slice(2)}:${Date.now()}`,
)
// 模块顶层挂个空 catch，避免 bcrypt 极端 reject 时触发 unhandledRejection；
// 请求路径上仍会 await 该 Promise，错误不会被吞。
dummyBcryptHashPromise.catch(() => {})

export async function POST(request: NextRequest) {
  try {
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

    const { ip } = getRequestInfo(request)

    // 检查用户名和 IP 是否被锁定，任一维度命中都拒绝登录。
    if ((await enforceLoginRateLimit(username, ip)).locked) {
      return jsonError({
        source: request,
        namespace: 'admin.login.errors',
        key: 'accountLocked',
        code: 'ACCOUNT_LOCKED',
        status: 429,
      })
    }

    const user = await maybeFirst(
      db.select().from(users).where(eq(users.username, username)).limit(1),
    )

    // 无论用户是否存在，都跑一次等成本的 bcrypt，消除时序侧信道
    const hashToCompare = user ? user.passwordHash : await dummyBcryptHashPromise
    const valid = await verifyPassword(password, hashToCompare)

    if (!user || !valid) {
      await recordLoginFailure(username, ip)
      if (user) await logActivity(request, user.id, 'login_fail')
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
    await clearLoginFailures(username)

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
