import { jsonError } from '@/server/lib/api-response'
import { NextResponse } from 'next/server'

/**
 * 判断数据库错误是否为唯一约束冲突
 * 兼容 SQLite（SQLITE_CONSTRAINT_UNIQUE）和 PostgreSQL（23505）
 */
export function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return (
    msg.includes('UNIQUE constraint failed') ||
    msg.includes('SQLITE_CONSTRAINT_UNIQUE') ||
    (err as any).code === '23505'
  )
}

/**
 * 安全解析请求体 JSON，返回解析结果或 400 错误响应
 */
export async function safeParseJson<T = any>(
  request: Request,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const data = await request.json()
    return { data }
  } catch {
    return {
      error: await jsonError({
        source: request,
        namespace: 'common.api',
        key: 'invalidJsonBody',
        code: 'INVALID_JSON',
        status: 400,
      }),
    }
  }
}

/**
 * 安全解析整数参数，返回有效值或默认值
 */
export function parseIntParam(
  value: string | null | undefined,
  defaultVal: number,
  min?: number,
  max?: number,
): number {
  const parsed = parseInt(value || '', 10)
  if (isNaN(parsed)) return defaultVal
  let result = parsed
  if (min !== undefined) result = Math.max(min, result)
  if (max !== undefined) result = Math.min(max, result)
  return result
}

/**
 * 解析路由中的 ID 参数，无效时返回 400 错误响应
 */
export async function parseIdParam(
  id: string,
  source?: Request,
): Promise<{ id: number; error?: never } | { id?: never; error: NextResponse }> {
  const parsed = parseInt(id, 10)
  if (isNaN(parsed) || parsed <= 0) {
    return {
      error: await jsonError({
        source,
        namespace: 'common.api',
        key: 'invalidId',
        code: 'VALIDATION_ERROR',
        status: 400,
      }),
    }
  }
  return { id: parsed }
}
