export function normalizeUsername(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePassword(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized || null
}

// 邮箱格式校验：简单但够用，覆盖 user 输入与下游 SMTP/Resend 校验场景
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * 解析并校验邮箱：空 / null / undefined 视为合法（返回 null），
 * 非空字符串必须满足邮箱格式，否则返回 INVALID_EMAIL。
 */
export function parseEmail(
  value: string | null | undefined,
): { success: true; data: string | null } | { success: false; code: 'INVALID_EMAIL' } {
  if (typeof value !== 'string') return { success: true, data: null }
  const trimmed = value.trim()
  if (!trimmed) return { success: true, data: null }
  if (!isValidEmail(trimmed)) return { success: false, code: 'INVALID_EMAIL' }
  return { success: true, data: trimmed }
}
