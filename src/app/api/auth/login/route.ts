import { createToken, setAuthCookie, verifyPassword } from '@/server/auth'
import { getRequestInfo } from '@/server/lib/request-info'
import { logActivity } from '@/server/services/activity-logs'
import { normalizePassword, normalizeUsername } from '@/lib/user-input'
import { db, dbReady } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { isLoginLocked, recordRateEvent } from '@/server/lib/rate-limit'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await dbReady

    const body = await request.json()
    const username = normalizeUsername(body?.username)
    const password = normalizePassword(body?.password)

    if (!username || !password) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' },
        { status: 400 },
      )
    }

    // 检查账号是否被锁定
    if (await isLoginLocked(username)) {
      return NextResponse.json(
        { success: false, code: 'ACCOUNT_LOCKED', message: '登录失败次数过多，请 5 分钟后再试' },
        { status: 429 },
      )
    }

    const { ip } = getRequestInfo(request)

    const user = await maybeFirst(
      db.select().from(users).where(eq(users.username, username)).limit(1),
    )
    if (!user) {
      await recordRateEvent('login_fail', username, ip)
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
        { status: 401 },
      )
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await recordRateEvent('login_fail', username, ip)
      return NextResponse.json(
        { success: false, code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
        { status: 401 },
      )
    }

    const token = await createToken({
      id: user.id,
      username: user.username,
      role: user.role as 'owner' | 'admin' | 'editor',
    })

    await setAuthCookie(token)

    await logActivity(request, user.id, 'login')

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('[POST /api/auth/login] Internal error:', error)
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 },
    )
  }
}
