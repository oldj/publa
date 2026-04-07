import type { ContentType } from '@/components/editors/content-convert'
import type { PageDraftMetadata, RevisionDraftPayload } from '@/shared/revision-metadata'

export interface PageSaveFormValues {
  title: string
  path: string
  template: string
  status: string
  publishedAt: string | null
  seoTitle: string
  seoDescription: string
}

export interface PageContentValues {
  contentType: ContentType
  contentRaw: string
  contentHtml: string
  contentText?: string
}

/** 构造页面草稿快照请求体，保存到 revision 草稿中 */
export function buildPageDraftPayload(
  form: PageSaveFormValues,
  content: PageContentValues,
): RevisionDraftPayload<PageDraftMetadata> {
  return {
    title: form.title,
    excerpt: '',
    contentType: content.contentType,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText || '',
    metadata: {
      path: form.path,
      template: form.template,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      publishedAt: form.publishedAt,
    },
  }
}

interface BuildPageSaveBodyOptions {
  publishedAt?: string | null
  now?: string
}

/** 构造页面主表保存请求体，供首次落盘和手动保存复用 */
export function buildPageSaveBody(
  form: PageSaveFormValues,
  content: PageContentValues,
  status?: string,
  options: BuildPageSaveBodyOptions = {},
) {
  const finalStatus = status || form.status
  return {
    ...form,
    path: form.path || null,
    contentType: content.contentType,
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText || '',
    status: finalStatus,
    publishedAt:
      options.publishedAt !== undefined
        ? options.publishedAt
        : finalStatus === 'draft'
          ? null
          : form.publishedAt || options.now || null,
  }
}
