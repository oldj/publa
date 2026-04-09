import crypto from 'crypto'

export const AUTH_COOKIE_NAME = '_token'

const DEFAULT_JWT_SECRET = 'blog-jwt-secret-change-me'

/**
 * 初始化 JWT secret。
 * 优先级：环境变量 > 数据库 > 自动生成。
 * 仅在 instrumentation.ts 中迁移完成后调用。
 */
export async function initJwtSecret(): Promise<void> {
  const raw = process.env.JWT_SECRET?.trim() || ''

  // 环境变量已配置有效值，无需处理
  if (raw && raw !== DEFAULT_JWT_SECRET) return

  // 非生产环境使用默认值，无需处理
  if (process.env.NODE_ENV !== 'production') return

  // 生产环境：从数据库读取或自动生成
  const { getSetting, setSetting } = await import('@/server/services/settings')

  const stored = await getSetting('jwtSecret')
  if (typeof stored === 'string' && stored) {
    process.env.JWT_SECRET = stored
    console.log('JWT secret loaded from database.')
    return
  }

  // 自动生成
  const generated = crypto.randomBytes(32).toString('base64url')
  await setSetting('jwtSecret', generated)
  process.env.JWT_SECRET = generated
  console.log('JWT secret auto-generated and saved to database.')
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigError'
  }
}

export function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET?.trim() || ''

  if (process.env.NODE_ENV === 'production' && (!raw || raw === DEFAULT_JWT_SECRET)) {
    throw new AuthConfigError('JWT_SECRET is not configured')
  }

  return new TextEncoder().encode(raw || DEFAULT_JWT_SECRET)
}

export function isAuthConfigError(error: unknown): error is AuthConfigError {
  return error instanceof AuthConfigError
}
