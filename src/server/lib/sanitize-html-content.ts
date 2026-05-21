import type { AuthRole } from '@/server/auth'
import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from './markdown'

const DEFAULT_BYPASS_ROLES: readonly AuthRole[] = ['owner', 'admin']

/**
 * 富文本编辑器保存时的 HTML 净化。复用 markdown 白名单，避免两套配置脱节。
 *
 * `bypassRoles` 来自后台设置（getHtmlSanitizeBypassRoles），列出哪些角色发布时跳过净化；
 * 不传时退回 owner / admin 兜底，与历史行为一致。命中 bypassRoles 的发布者完全可信，
 * 内容原样保存——前台 XSS 风险由站长/管理员自负。
 */
export function sanitizeRichTextHtml(
  html: string | null | undefined,
  options?: { role?: AuthRole; bypassRoles?: readonly AuthRole[] },
): string {
  if (!html) return ''
  const bypassRoles = options?.bypassRoles ?? DEFAULT_BYPASS_ROLES
  if (options?.role && bypassRoles.includes(options.role)) {
    return html
  }
  return sanitizeHtml(html, sanitizeOptions)
}
