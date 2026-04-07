import { parsePageDraftMetadata, parsePostDraftMetadata } from '@/shared/revision-metadata'
import type { PageInput } from './pages'
import type { PostInput } from './posts'
import type { RevisionContent } from './revisions'

/** 构造文章恢复版本时写回主表的字段 */
export function buildPostRestoreInput(
  content: RevisionContent,
  tagIds: number[],
): Partial<PostInput> {
  const metadata = parsePostDraftMetadata(content.metadata)

  return {
    title: content.title,
    excerpt: content.excerpt || undefined,
    contentType: content.contentType,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    categoryId: metadata.categoryId,
    tagIds,
    coverImage: metadata.coverImage || undefined,
    seoTitle: metadata.seoTitle || undefined,
    seoDescription: metadata.seoDescription || undefined,
    status: 'published',
  }
}

/** 构造页面恢复版本时写回主表的字段 */
export function buildPageRestoreInput(content: RevisionContent): Partial<PageInput> {
  const metadata = parsePageDraftMetadata(content.metadata)

  return {
    title: content.title,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentType: content.contentType,
    template: metadata.template === 'blank' ? 'blank' : 'default',
    mimeType: metadata.mimeType || undefined,
    seoTitle: metadata.seoTitle || undefined,
    seoDescription: metadata.seoDescription || undefined,
    status: 'published',
  }
}
