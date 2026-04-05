import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { createToken, hashPassword, setAuthCookie } from '@/server/auth'
import { db, dbReady } from '@/server/db'
import { insertOne, maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { seed } from '@/server/db/seed'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await dbReady

    // 检查是否已经初始化
    const existingOwner = await maybeFirst(
      db.select().from(users).where(eq(users.role, 'owner')).limit(1),
    )
    if (existingOwner) {
      return NextResponse.json(
        { success: false, code: 'ALREADY_INITIALIZED', message: '系统已初始化' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const username = normalizeUsername(body?.username)
    const password = normalizePassword(body?.password)
    const email = normalizeEmail(body?.email)

    if (!username || !password) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' },
        { status: 400 },
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '密码长度至少 6 位' },
        { status: 400 },
      )
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

      // 填充默认数据
      await seed(tx)

      return owner
    })

    // 自动登录
    const token = await createToken({
      id: owner.id,
      username: owner.username,
      role: 'owner',
    })
    await setAuthCookie(token)

    return NextResponse.json({
      success: true,
      data: {
        id: owner.id,
        username: owner.username,
        role: owner.role,
      },
    })
  } catch (error) {
    console.error('[POST /api/setup] Internal error:', error)
    return NextResponse.json(
      { success: false, code: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 },
    )
  }
}
