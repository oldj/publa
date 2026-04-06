import type { ContentType } from '@/components/editors/content-convert'
import type { PostDraftMetadata, RevisionDraftPayload } from '@/shared/revision-metadata'

export interface PostSaveFormValues {
  title: string
  slug: string
  excerpt: string
  categoryId: string
  tagNames: string[]
  allowComment: boolean
  showComments: boolean
  pinned: boolean
  publishedAt: string | null
  coverImage: string
  seoTitle: string
  seoDescription: string
}

export interface PostContentValues {
  contentType: ContentType
  contentRaw: string
  contentHtml: string
  contentText: string
}

interface BuildPostSaveBodyOptions {
  publishedAt?: string | null
  now?: string
}

/** 构造文章草稿快照请求体，保存到 revision 草稿中 */
export function buildPostDraftPayload(
  form: PostSaveFormValues,
  content: PostContentValues,
): RevisionDraftPayload<PostDraftMetadata> {
  return {
    title: form.title,
    excerpt: form.excerpt,
    contentType: content.contentType,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    metadata: {
      slug: form.slug,
      categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
      tagNames: form.tagNames,
      coverImage: form.coverImage,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      publishedAt: form.publishedAt,
    },
  }
}

/** 构造文章主表保存请求体，供首次落盘和手动保存复用 */
export function buildPostSaveBody(
  form: PostSaveFormValues,
  content: PostContentValues,
  tagIds: number[],
  status: string,
  options: BuildPostSaveBodyOptions = {},
) {
  return {
    title: form.title,
    slug: form.slug || null,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    contentType: content.contentType,
    excerpt: form.excerpt || undefined,
    coverImage: form.coverImage || null,
    status,
    categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
    tagIds,
    tagNames: form.tagNames,
    allowComment: form.allowComment,
    showComments: form.showComments,
    pinned: form.pinned,
    publishedAt:
      options.publishedAt !== undefined
        ? options.publishedAt
        : status === 'draft'
          ? null
          : form.publishedAt || options.now || null,
    seoTitle: form.seoTitle || undefined,
    seoDescription: form.seoDescription || undefined,
  }
}
