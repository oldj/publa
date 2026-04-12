import { getPageReservedPrefixes } from '@/lib/admin-path'
import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { contentRevisions, contents } from '@/server/db/schema'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { and, count, desc, eq, exists, isNull, like, lte, ne, or, sql } from 'drizzle-orm'
import { listDraftsByTargetIds } from './revisions'

export type PagePathValidationCode =
  | 'REQUIRED'
  | 'ENDS_WITH_SLASH'
  | 'STARTS_WITH_SLASH'
  | 'STARTS_WITH_HYPHEN'
  | 'ENDS_WITH_HYPHEN'
  | 'RESERVED'

/** 校验页面路径 */
export function validatePagePath(
  path: string,
  _excludeId?: number,
): { valid: true } | { valid: false; code: PagePathValidationCode; values?: { segment: string } } {
  if (!path) {
    return { valid: false, code: 'REQUIRED' }
  }

  if (path.endsWith('/')) {
    return { valid: false, code: 'ENDS_WITH_SLASH' }
  }

  if (path.startsWith('/')) {
    return { valid: false, code: 'STARTS_WITH_SLASH' }
  }

  if (path.startsWith('-')) {
    return { valid: false, code: 'STARTS_WITH_HYPHEN' }
  }

  if (path.endsWith('-')) {
    return { valid: false, code: 'ENDS_WITH_HYPHEN' }
  }

  const topSegment = path.split('/')[0]
  if (getPageReservedPrefixes().includes(topSegment)) {
    return { valid: false, code: 'RESERVED', values: { segment: topSegment } }
  }

  return { valid: true }
}

/** 检查路径是否唯一 */
export async function isPagePathAvailable(path: string, excludeId?: number): Promise<boolean> {
  const conditions = [
    eq(contents.path, path),
    eq(contents.type, 'page'),
    isNull(contents.deletedAt),
  ]
  if (excludeId) conditions.push(ne(contents.id, excludeId))
  const existing = await maybeFirst(
    db
      .select({ id: contents.id })
      .from(contents)
      .where(and(...conditions))
      .limit(1),
  )
  return !existing
}

export interface PageInput {
  title: string
  path: string
  contentType?: 'richtext' | 'markdown' | 'html'
  contentRaw: string
  contentHtml: string
  template?: 'default' | 'blank'
  mimeType?: string
  status?: 'draft' | 'scheduled' | 'published'
  seoTitle?: string
  seoDescription?: string
  canonicalUrl?: string
  publishedAt?: string | null
}

/** 列出所有页面（后台） */
export async function listPages(
  options: { page?: number; pageSize?: number; status?: string; search?: string } = {},
) {
  const { page = 1, pageSize = 50, status, search } = options

  // 基础条件（不含 status 筛选，用于计算各状态计数）
  const baseConditions: ReturnType<typeof eq>[] = [
    eq(contents.type, 'page'),
    isNull(contents.deletedAt),
  ]
  if (search) {
    baseConditions.push(
      or(
        like(contents.title, `%${search}%`),
        like(contents.path, `%${search}%`),
        exists(
          db
            .select({ id: contentRevisions.id })
            .from(contentRevisions)
            .where(
              and(
                eq(contentRevisions.targetType, 'page'),
                eq(contentRevisions.targetId, contents.id),
                eq(contentRevisions.status, 'draft'),
                like(contentRevisions.title, `%${search}%`),
              ),
            ),
        ),
      )!,
    )
  }

  // 各状态计数
  const countRows = await db
    .select({ status: contents.status, count: count() })
    .from(contents)
    .where(and(...baseConditions))
    .groupBy(contents.status)

  const statusCounts: Record<string, number> = { draft: 0, scheduled: 0, published: 0 }
  for (const row of countRows) {
    if (row.status in statusCounts) statusCounts[row.status] = row.count
  }

  // 加上 status 筛选条件
  const conditions = [...baseConditions]
  if (status) conditions.push(eq(contents.status, status as any))
  const where = and(...conditions)

  const [{ total }] = await db.select({ total: count() }).from(contents).where(where)

  const rows = await db
    .select()
    .from(contents)
    .where(where)
    .orderBy(
      // 从未发布过的草稿置顶，已发布过的按发布时间倒序
      sql`CASE WHEN ${contents.publishedAt} IS NULL THEN 0 ELSE 1 END`,
      desc(contents.publishedAt),
      desc(contents.createdAt),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const drafts = await listDraftsByTargetIds(
    'page',
    rows.map((row) => row.id),
  )
  const draftMap = new Map(drafts.map((draft) => [draft.targetId, draft]))
  const items = rows.map((row) => {
    const draft = draftMap.get(row.id)
    if (!draft) return { ...row, hasDraft: false }

    const metadata = parsePageDraftMetadata(draft.metadata)

    return {
      ...row,
      title: draft.title,
      path: metadata.path || null,
      template: metadata.template,
      contentType: draft.contentType,
      hasDraft: true,
    }
  })

  return {
    items,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    itemCount: total,
    statusCounts,
  }
}

/** 将到期的定时发布页面自动转为已发布 */
export async function publishScheduledPages() {
  const now = new Date().toISOString()
  await db
    .update(contents)
    .set({ status: 'published' })
    .where(
      and(
        eq(contents.type, 'page'),
        eq(contents.status, 'scheduled'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      ),
    )
}

/** 通过 path 获取已发布页面（前台） */
export async function getPublishedPageByPath(path: string) {
  await publishScheduledPages()
  return maybeFirst(
    db
      .select()
      .from(contents)
      .where(
        and(
          eq(contents.type, 'page'),
          eq(contents.path, path),
          eq(contents.status, 'published'),
          isNull(contents.deletedAt),
        ),
      )
      .limit(1),
  )
}

/** 通过 ID 获取页面 */
export async function getPageById(id: number) {
  return maybeFirst(
    db
      .select()
      .from(contents)
      .where(and(eq(contents.id, id), eq(contents.type, 'page')))
      .limit(1),
  )
}

/** 创建空草稿页面（无需必填字段） */
export async function createEmptyPage() {
  return insertOne(
    db
      .insert(contents)
      .values({
        type: 'page',
        title: '',
        path: null,
        contentRaw: '',
        contentHtml: '',
        template: 'default',
        status: 'draft',
      })
      .returning(),
  )
}

/** 创建页面 */
export async function createPage(input: PageInput) {
  return insertOne(
    db
      .insert(contents)
      .values({
        type: 'page',
        title: input.title,
        path: input.path,
        contentType: input.contentType || 'richtext',
        contentRaw: input.contentRaw,
        contentHtml: input.contentHtml,
        template: input.template || 'default',
        mimeType: input.mimeType || null,
        status: input.status || 'draft',
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        canonicalUrl: input.canonicalUrl || null,
        publishedAt:
          input.publishedAt || (input.status === 'published' ? new Date().toISOString() : null),
      })
      .returning(),
  )
}

/** 更新页面 */
export async function updatePage(
  id: number,
  input: Partial<PageInput>,
  tx: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'> = db,
) {
  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (input.title !== undefined) updateData.title = input.title
  if (input.path !== undefined) updateData.path = input.path
  if (input.contentType !== undefined) updateData.contentType = input.contentType
  if (input.contentRaw !== undefined) updateData.contentRaw = input.contentRaw
  if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml
  if (input.template !== undefined) updateData.template = input.template
  if (input.mimeType !== undefined) updateData.mimeType = input.mimeType || null
  if (input.status !== undefined) updateData.status = input.status
  if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle || null
  if (input.seoDescription !== undefined) updateData.seoDescription = input.seoDescription || null
  if (input.canonicalUrl !== undefined) updateData.canonicalUrl = input.canonicalUrl || null
  if (input.publishedAt !== undefined) updateData.publishedAt = input.publishedAt

  return updateOne(
    tx
      .update(contents)
      .set(updateData)
      .where(and(eq(contents.id, id), eq(contents.type, 'page')))
      .returning(),
  )
}

/** 软删除页面 */
export async function deletePage(id: number) {
  const { deleteRevisionsByTarget } = await import('./revisions')
  await db.transaction(async (tx) => {
    await tx
      .update(contents)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(contents.id, id), eq(contents.type, 'page')))
    await deleteRevisionsByTarget('page', id, tx)
  })
  return { success: true }
}
