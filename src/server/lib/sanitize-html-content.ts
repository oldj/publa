import type { AuthRole } from '@/server/auth'
import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from './markdown'

/**
 * 富文本编辑器保存时的 HTML 净化。
 * 复用 markdown 白名单，避免两套配置脱节。
 *
 * 当调用方传入 owner / admin 角色时，认为发布者完全可信，跳过净化原样返回。
 * 站长 / 管理员对前台 XSS 自行负责；editor 及未知来源仍走白名单。
 */
export function sanitizeRichTextHtml(
  html: string | null | undefined,
  options?: { role?: AuthRole },
): string {
  if (!html) return ''
  if (options?.role === 'owner' || options?.role === 'admin') {
    return html
  }
  return sanitizeHtml(html, sanitizeOptions)
}
