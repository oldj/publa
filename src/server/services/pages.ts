import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { contents } from '@/server/db/schema'
import { and, count, desc, eq, isNull, lte, ne } from 'drizzle-orm'

/** 保留路径，页面不能使用 */
const RESERVED_PATHS = ['admin', 'api', 'setup', 'rss.xml', 'sitemap.xml', 'uploads', 'posts']

/** 校验页面路径 */
export function validatePagePath(
  path: string,
  excludeId?: number,
): { valid: boolean; message?: string } {
  if (!path) {
    return { valid: false, message: '路径不能为空' }
  }

  if (path.endsWith('/')) {
    return { valid: false, message: '路径不能以 / 结尾' }
  }

  if (path.startsWith('/')) {
    return { valid: false, message: '路径不能以 / 开头' }
  }

  const topSegment = path.split('/')[0]
  if (RESERVED_PATHS.includes(topSegment)) {
    return { valid: false, message: `"${topSegment}" 是保留路径，不能使用` }
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
  status?: 'draft' | 'scheduled' | 'published'
  seoTitle?: string
  seoDescription?: string
  canonicalUrl?: string
  publishedAt?: string | null
}

/** 列出所有页面（后台） */
export async function listPages(options: { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 50 } = options

  const where = and(eq(contents.type, 'page'), isNull(contents.deletedAt))
  const [{ total }] = await db.select({ total: count() }).from(contents).where(where)

  const rows = await db
    .select()
    .from(contents)
    .where(where)
    .orderBy(desc(contents.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { items: rows, page, pageSize, pageCount: Math.ceil(total / pageSize), itemCount: total }
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
export async function updatePage(id: number, input: Partial<PageInput>) {
  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (input.title !== undefined) updateData.title = input.title
  if (input.path !== undefined) updateData.path = input.path
  if (input.contentType !== undefined) updateData.contentType = input.contentType
  if (input.contentRaw !== undefined) updateData.contentRaw = input.contentRaw
  if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml
  if (input.template !== undefined) updateData.template = input.template
  if (input.status !== undefined) updateData.status = input.status
  if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle || null
  if (input.seoDescription !== undefined) updateData.seoDescription = input.seoDescription || null
  if (input.canonicalUrl !== undefined) updateData.canonicalUrl = input.canonicalUrl || null
  if (input.publishedAt !== undefined) updateData.publishedAt = input.publishedAt

  return updateOne(
    db
      .update(contents)
      .set(updateData)
      .where(and(eq(contents.id, id), eq(contents.type, 'page')))
      .returning(),
  )
}

/** 软删除页面 */
export async function deletePage(id: number) {
  await db
    .update(contents)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(contents.id, id), eq(contents.type, 'page')))
  // 清除关联的修订记录
  const { deleteRevisionsByTarget } = await import('./revisions')
  await deleteRevisionsByTarget('page', id)
  return { success: true }
}
