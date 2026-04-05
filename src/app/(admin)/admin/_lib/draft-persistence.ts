import type { ContentType } from '@/components/editors/content-convert'

interface DraftCreationInput {
  title: string
  contentType: ContentType
  currentContent: string
  richTextText?: string | null
}

/** 判断是否应为新建内容创建首条草稿记录 */
export function shouldCreateDraftRecord({
  title,
  contentType,
  currentContent,
  richTextText,
}: DraftCreationInput) {
  if (title.trim()) return true
  if (!currentContent) return false

  if (contentType === 'richtext') {
    return (richTextText?.trim().length ?? 0) > 0
  }

  return currentContent.trim().length > 0
}
