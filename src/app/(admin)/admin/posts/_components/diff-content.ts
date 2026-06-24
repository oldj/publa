import { formatHtmlForDiff } from './format-html'

/** revision 内容字段子集，用于挑选对比文本 */
export interface DiffContentFields {
  contentType: string
  contentRaw: string
  contentHtml: string
}

/**
 * 取「用户真正编辑的内容」作为对比文本：
 * - 富文本：渲染后的 HTML 源码，格式化拆行便于逐行 diff
 * - markdown / html 源码模式：直接用编辑原文 contentRaw（本就多行，保持原样）
 *
 * 注意 markdown 模式的 contentHtml 实为空，必须走 contentRaw 分支。
 */
export function pickDiffText({ contentType, contentRaw, contentHtml }: DiffContentFields): string {
  return contentType === 'markdown' || contentType === 'html'
    ? (contentRaw ?? '')
    : formatHtmlForDiff(contentHtml ?? '')
}
