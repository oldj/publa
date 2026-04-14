import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import type { TranslationValues } from '@/i18n/core'
import { jsonError } from '@/server/lib/api-response'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  AUTH_COOKIE_NAME,
  TOKEN_MAX_AGE,
  getJwtSecret,
  isAuthConfigError,
  shouldRenewToken,
} from './shared'

const SALT_ROUNDS = 10

export interface AuthUser {
  id: number
  username: string
  role: 'owner' | 'admin' | 'editor'
}

export type AuthRole = AuthUser['role']

interface TokenPayload extends JWTPayload {
  userId: number
  username: string
  role: string
}

type AuthGuardResult = { ok: true; user: AuthUser } | { ok: false; response: NextResponse }
type TranslatedMessage =
  | string
  | {
      namespace: string
      key: string
      values?: TranslationValues
    }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(user: AuthUser): Promise<string> {
  const jwtSecret = getJwtSecret()

  return new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
    .sign(jwtSecret)
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as TokenPayload
  } catch (error) {
    if (isAuthConfigError(error)) throw error
    return null
  }
}

/** 从请求 cookie 中获取当前登录用户 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  // 验证用户是否仍然存在
  const user = await maybeFirst(
    db.select().from(users).where(eq(users.id, payload.userId)).limit(1),
  )
  if (!user) return null

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    role: user.role as AuthUser['role'],
  }

  // 剩余有效期不足一半时尝试续期（Server Component 中无法修改 cookie，静默跳过）
  if (shouldRenewToken(payload.exp)) {
    try {
      const newToken = await createToken(authUser)
      await setAuthCookie(newToken)
    } catch {
      // Server Component 中不允许修改 cookie，下次 API 调用时会续期
    }
  }

  return authUser
}

/** 设置认证 cookie */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  })
}

/** 清除认证 cookie */
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
}

/** 检查系统是否已初始化（是否存在 owner） */
export async function isSystemInitialized(): Promise<boolean> {
  const owner = await maybeFirst(db.select().from(users).where(eq(users.role, 'owner')).limit(1))
  return !!owner
}

export function hasRole(
  user: Pick<AuthUser, 'role'> | null,
  roles: AuthRole | AuthRole[],
): boolean {
  if (!user) return false

  const roleList = Array.isArray(roles) ? roles : [roles]
  return roleList.includes(user.role)
}

async function buildAuthErrorResponse(
  code: 'UNAUTHORIZED' | 'FORBIDDEN',
  fallbackKey: 'unauthorized' | 'forbidden',
  message?: TranslatedMessage,
) {
  if (typeof message === 'string') {
    return NextResponse.json(
      { success: false, code, message },
      { status: code === 'UNAUTHORIZED' ? 401 : 403 },
    )
  }

  return jsonError({
    namespace: message?.namespace ?? 'common.api',
    key: message?.key ?? fallbackKey,
    values: message?.values,
    code,
    status: code === 'UNAUTHORIZED' ? 401 : 403,
  })
}

export async function unauthorizedResponse(message?: TranslatedMessage) {
  return buildAuthErrorResponse('UNAUTHORIZED', 'unauthorized', message)
}

export async function forbiddenResponse(message?: TranslatedMessage) {
  return buildAuthErrorResponse('FORBIDDEN', 'forbidden', message)
}

export async function requireCurrentUser(): Promise<AuthGuardResult> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, response: await unauthorizedResponse() }
    }

    return { ok: true, user }
  } catch (error) {
    if (isAuthConfigError(error)) {
      return {
        ok: false,
        response: await jsonError({
          namespace: 'common.api',
          key: 'authenticationUnavailable',
          code: 'CONFIGURATION_ERROR',
          status: 503,
        }),
      }
    }
    throw error
  }
}

export async function requireRole(
  roles: AuthRole | AuthRole[],
  message?: TranslatedMessage,
): Promise<AuthGuardResult> {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard

  if (!hasRole(guard.user, roles)) {
    return { ok: false, response: await forbiddenResponse(message) }
  }

  return guard
}

export { AUTH_COOKIE_NAME }
