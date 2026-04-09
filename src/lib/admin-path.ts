// 自定义后台路径，通过环境变量 ADMIN_PATH 指定
// 不设置或设置为 'admin' 时行为与默认完全一致

/** 合法字符：字母、数字、下划线、连字符（在正则中均无特殊含义，可安全拼入 RegExp） */
const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/

/** 所有保留路径前缀，ADMIN_PATH 不可使用这些值，页面路径的首段也不可使用 */
export const RESERVED_PREFIXES = new Set([
  'admin',
  'api',
  '_next',
  'setup',
  'posts',
  'category',
  'tag',
  'guestbook',
  'uploads',
  'rss.xml',
  'sitemap.xml',
])

let cachedAdminPath: string | undefined

/** 返回归一化的后台路径段（不含首尾斜杠），默认 'admin' */
export function getAdminPath(): string {
  if (cachedAdminPath !== undefined) return cachedAdminPath

  const raw = (process.env.ADMIN_PATH ?? 'admin').trim().replace(/^\/+|\/+$/g, '')

  if (!raw || !SLUG_PATTERN.test(raw) || RESERVED_PREFIXES.has(raw)) {
    if (raw && raw !== 'admin') {
      console.warn(`[admin-path] Invalid ADMIN_PATH="${raw}", falling back to "admin"`)
    }
    cachedAdminPath = 'admin'
  } else {
    cachedAdminPath = raw
  }

  return cachedAdminPath
}

/** 构建后台完整路径，如 adminUrl('/posts') => '/my-admin/posts' */
export function adminUrl(subpath?: string): string {
  const base = `/${getAdminPath()}`
  if (!subpath) return base
  return `${base}${subpath.startsWith('/') ? subpath : `/${subpath}`}`
}

/** 返回页面路径校验用的保留前缀列表（含自定义后台路径） */
export function getPageReservedPrefixes(): string[] {
  const adminPath = getAdminPath()
  const prefixes = [...RESERVED_PREFIXES]
  if (adminPath !== 'admin') {
    prefixes.push(adminPath)
  }
  return prefixes
}

/** 重置缓存（仅供测试使用） */
export function _resetCacheForTest(): void {
  cachedAdminPath = undefined
}
