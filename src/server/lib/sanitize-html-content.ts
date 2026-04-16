import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from './markdown'

/**
 * 富文本编辑器保存时的 HTML 净化。
 * 复用 markdown 白名单，避免两套配置脱节。
 */
export function sanitizeRichTextHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, sanitizeOptions)
}
