/**
 * 预览服务：通过内容 ID 获取预览数据，合并草稿修订
 */
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { categories, contents, tags } from '@/server/db/schema'
import { getDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata, parsePostDraftMetadata } from '@/shared/revision-metadata'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { IPost, ITag } from 'typings'

export const PREVIEW_PREFIX = '--preview-'

/** 从 slug/path 中解析预览 ID，非预览则返回 null */
export function parsePreviewId(slug: string): number | null {
  if (!slug.startsWith(PREVIEW_PREFIX)) return null
  const id = parseInt(slug.slice(PREVIEW_PREFIX.length), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** 通过 ID 获取文章预览数据，合并草稿修订，构建 IPost */
export async function getPreviewPost(contentId: number): Promise<IPost | null> {
  const row = await maybeFirst(
    db
      .select()
      .from(contents)
      .where(and(eq(contents.id, contentId), eq(contents.type, 'post'), isNull(contents.deletedAt)))
      .limit(1),
  )
  if (!row) return null

  const draft = await getDraft('post', contentId)

  // 合并草稿内容
  let title = row.title || ''
  let contentHtml = row.contentHtml || ''
  let slug = row.slug || ''
  let coverImage = row.coverImage || ''
  let categoryId = row.categoryId
  let tagNames: string[] = []
  let pubTime = row.publishedAt || row.createdAt

  if (draft) {
    title = draft.title || title
    contentHtml = draft.contentHtml || contentHtml
    const meta = parsePostDraftMetadata(draft.metadata)
    slug = meta.slug || slug
    coverImage = meta.coverImage || coverImage
    categoryId = meta.categoryId ?? categoryId
    tagNames = meta.tagNames || []
    if (meta.publishedAt) pubTime = meta.publishedAt
  }

  // 解析分类
  let category = null
  if (categoryId) {
    const cat = await maybeFirst(
      db.select().from(categories).where(eq(categories.id, categoryId)).limit(1),
    )
    if (cat) {
      category = { id: cat.id, name: cat.name, count: 0 }
    }
  }

  // 解析标签
  let postTags: ITag[] = []
  if (tagNames.length > 0) {
    const tagRows = await db.select().from(tags).where(inArray(tags.name, tagNames))
    postTags = tagRows.map((t) => ({ id: t.id, name: t.name, count: 0 }))
    // 草稿中可能包含尚未创建的标签
    for (const name of tagNames) {
      if (!postTags.find((t) => t.name === name)) {
        postTags.push({ id: 0, name, count: 0 })
      }
    }
  }

  return {
    id: row.id,
    title,
    html: contentHtml,
    url: slug ? `/posts/${slug}` : '',
    slug,
    coverImage: coverImage || undefined,
    pubTime,
    category,
    tags: postTags,
    previous: { title: '', url: '' },
    next: { title: '', url: '' },
    comments: [],
    canComment: false,
    canShowComments: false,
    related: [],
  }
}

export interface PreviewPageData {
  id: number
  title: string
  contentHtml: string
  template: 'default' | 'blank'
  mimeType: string
  seoTitle: string
  seoDescription: string
}

/** 通过 ID 获取页面预览数据，合并草稿修订 */
export async function getPreviewPage(contentId: number): Promise<PreviewPageData | null> {
  const row = await maybeFirst(
    db
      .select()
      .from(contents)
      .where(and(eq(contents.id, contentId), eq(contents.type, 'page'), isNull(contents.deletedAt)))
      .limit(1),
  )
  if (!row) return null

  const draft = await getDraft('page', contentId)

  let title = row.title || ''
  let contentHtml = row.contentHtml || ''
  let template: 'default' | 'blank' = (row.template as 'default' | 'blank') || 'default'
  let mimeType = row.mimeType || ''
  let seoTitle = row.seoTitle || ''
  let seoDescription = row.seoDescription || ''

  if (draft) {
    title = draft.title || title
    contentHtml = draft.contentHtml || contentHtml
    const meta = parsePageDraftMetadata(draft.metadata)
    template =
      meta.template === 'blank' ? 'blank' : meta.template === 'default' ? 'default' : template
    mimeType = meta.mimeType || mimeType
    seoTitle = meta.seoTitle || seoTitle
    seoDescription = meta.seoDescription || seoDescription
  }

  return { id: row.id, title, contentHtml, template, mimeType, seoTitle, seoDescription }
}
