import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import {
  categories,
  comments,
  contentRevisions,
  contents,
  contentTags,
  slugHistories,
  tags,
} from '@/server/db/schema'
import { and, asc, count, desc, eq, exists, isNull, like, lte, ne, or, sql } from 'drizzle-orm'
import { listDraftsByTargetIds } from './revisions'

export interface PostInput {
  title: string
  slug: string
  authorId: number
  contentType?: 'richtext' | 'markdown' | 'html'
  contentRaw: string
  contentHtml: string
  contentText: string
  excerpt?: string
  status: 'draft' | 'scheduled' | 'published'
  categoryId?: number | null
  tagIds?: number[]
  allowComment?: boolean
  showComments?: boolean
  coverImage?: string | null
  seoTitle?: string
  seoDescription?: string
  canonicalUrl?: string
  publishedAt?: string | null
  pinned?: boolean
}

export interface PostListOptions {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: number
  tagId?: number
  search?: string
}

/** 文章列表（后台，含所有状态） */
export async function listPostsAdmin(options: PostListOptions = {}) {
  const { page = 1, pageSize = 20, status, categoryId, search } = options

  // 基础条件（不含 status 筛选，用于计算各状态计数）
  const baseConditions: ReturnType<typeof eq>[] = [
    eq(contents.type, 'post'),
    isNull(contents.deletedAt),
  ]
  if (categoryId) baseConditions.push(eq(contents.categoryId, categoryId))
  if (search) {
    // 同时匹配标题、slug 和草稿标题
    baseConditions.push(
      or(
        like(contents.title, `%${search}%`),
        like(contents.slug, `%${search}%`),
        exists(
          db
            .select({ id: contentRevisions.id })
            .from(contentRevisions)
            .where(
              and(
                eq(contentRevisions.targetType, 'post'),
                eq(contentRevisions.targetId, contents.id),
                eq(contentRevisions.status, 'draft'),
                like(contentRevisions.title, `%${search}%`),
              ),
            ),
        ),
      )!,
    )
  }

  // 各状态计数（不受当前 status 筛选影响）
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
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      status: contents.status,
      authorId: contents.authorId,
      categoryId: contents.categoryId,
      categoryName: categories.name,
      viewCount: contents.viewCount,
      commentCount:
        sql<number>`(SELECT COUNT(*) FROM ${comments} WHERE ${comments.contentId} = ${contents.id} AND ${comments.deletedAt} IS NULL)`.as(
          'commentCount',
        ),
      pinned: contents.pinned,
      allowComment: contents.allowComment,
      createdAt: contents.createdAt,
      updatedAt: contents.updatedAt,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .leftJoin(categories, eq(contents.categoryId, categories.id))
    .where(where)
    .orderBy(
      desc(contents.pinned),
      // 从未发布过的草稿置顶，已发布过的按发布时间倒序
      sql`CASE WHEN ${contents.publishedAt} IS NULL THEN 0 ELSE 1 END`,
      desc(contents.publishedAt),
      desc(contents.createdAt),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const drafts = await listDraftsByTargetIds(
    'post',
    rows.map((row) => row.id),
  )
  const draftMap = new Map(drafts.map((draft) => [draft.targetId, draft]))
  const items = rows.map((row) => {
    const draft = draftMap.get(row.id)
    if (!draft) return { ...row, hasDraft: false }

    return {
      ...row,
      title: draft.title,
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

/** 已发布文章列表（前台） */
export async function listPostsPublished(options: PostListOptions = {}) {
  const { page = 1, pageSize = 10, categoryId, tagId } = options
  const now = new Date().toISOString()

  let baseConditions = and(
    eq(contents.type, 'post'),
    eq(contents.status, 'published'),
    lte(contents.publishedAt, now),
    isNull(contents.deletedAt),
  )

  if (categoryId) {
    baseConditions = and(baseConditions, eq(contents.categoryId, categoryId))
  }

  if (tagId) {
    baseConditions = and(
      baseConditions,
      exists(
        db
          .select({ value: sql`1` })
          .from(contentTags)
          .where(and(eq(contentTags.contentId, contents.id), eq(contentTags.tagId, tagId))),
      ),
    )
  }

  const [{ total }] = await db.select({ total: count() }).from(contents).where(baseConditions)

  const rows = await db
    .select()
    .from(contents)
    .where(baseConditions)
    .orderBy(desc(contents.pinned), desc(contents.publishedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    items: rows,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    itemCount: total,
  }
}

/** 通过 ID 获取文章 */
export async function getPostById(id: number) {
  const post = await maybeFirst(
    db
      .select()
      .from(contents)
      .where(and(eq(contents.type, 'post'), eq(contents.id, id)))
      .limit(1),
  )
  if (!post) return null

  const postTagRows = await db
    .select({ tagId: contentTags.tagId, tagName: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, id))

  return {
    ...post,
    tagIds: postTagRows.map((r) => r.tagId),
    tagNames: postTagRows.map((r) => r.tagName),
  }
}

/** 通过 slug 获取已发布文章（前台） */
export async function getPostBySlug(slug: string) {
  const now = new Date().toISOString()

  let post = await maybeFirst(
    db
      .select()
      .from(contents)
      .where(
        and(
          eq(contents.type, 'post'),
          eq(contents.slug, slug),
          eq(contents.status, 'published'),
          lte(contents.publishedAt, now),
          isNull(contents.deletedAt),
        ),
      )
      .limit(1),
  )

  // 查找 slug 历史记录（用于 301 重定向）
  if (!post) {
    const history = await maybeFirst(
      db.select().from(slugHistories).where(eq(slugHistories.slug, slug)).limit(1),
    )

    if (history) {
      const redirectPost = await maybeFirst(
        db
          .select()
          .from(contents)
          .where(
            and(
              eq(contents.type, 'post'),
              eq(contents.id, history.contentId),
              eq(contents.status, 'published'),
              isNull(contents.deletedAt),
            ),
          )
          .limit(1),
      )

      if (redirectPost) {
        return { redirect: redirectPost.slug }
      }
    }
    return null
  }

  // 获取标签
  const postTagRows = await db
    .select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, post.id))

  // 获取分类
  const category = post.categoryId
    ? await maybeFirst(
        db.select().from(categories).where(eq(categories.id, post.categoryId)).limit(1),
      )
    : null

  // 获取前后篇
  const previous = await db
    .select({ title: contents.title, slug: contents.slug })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
        post.publishedAt ? sql`${contents.publishedAt} < ${post.publishedAt}` : sql`1=0`,
      ),
    )
    .orderBy(desc(contents.publishedAt))
    .limit(1)

  const next = await db
    .select({ title: contents.title, slug: contents.slug })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
        post.publishedAt ? sql`${contents.publishedAt} > ${post.publishedAt}` : sql`1=0`,
      ),
    )
    .orderBy(asc(contents.publishedAt))
    .limit(1)

  // 获取已审核评论
  const commentRows = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.contentId, post.id),
        eq(comments.status, 'approved'),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt))

  // 增加阅读量
  await db
    .update(contents)
    .set({ viewCount: sql`${contents.viewCount} + 1` })
    .where(eq(contents.id, post.id))

  return {
    post,
    tags: postTagRows,
    category,
    previous: previous[0] || null,
    next: next[0] || null,
    comments: commentRows,
  }
}

/** 归档列表（按年分组） */
export async function getArchive() {
  const now = new Date().toISOString()

  const rows = await db
    .select({
      id: contents.id,
      title: contents.title,
      slug: contents.slug,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(desc(contents.publishedAt))

  // 按年分组
  const archive: Record<string, typeof rows> = {}
  for (const row of rows) {
    const year = row.publishedAt ? row.publishedAt.substring(0, 4) : 'unknown'
    if (!archive[year]) archive[year] = []
    archive[year].push(row)
  }

  return Object.entries(archive).map(([year, items]) => ({ year, items }))
}

/** 创建空草稿文章（无需必填字段） */
export async function createEmptyPost(authorId: number) {
  return insertOne(
    db
      .insert(contents)
      .values({
        type: 'post',
        title: '',
        slug: null,
        authorId,
        contentRaw: '',
        contentHtml: '',
        contentText: '',
        status: 'draft',
      })
      .returning(),
  )
}

/** 创建文章 */
export async function createPost(input: PostInput) {
  const post = await insertOne(
    db
      .insert(contents)
      .values({
        type: 'post',
        title: input.title,
        slug: input.slug,
        authorId: input.authorId,
        contentType: input.contentType || 'richtext',
        contentRaw: input.contentRaw,
        contentHtml: input.contentHtml,
        contentText: input.contentText,
        excerpt: input.excerpt || null,
        excerptAuto: input.contentText.substring(0, 200),
        status: input.status,
        categoryId: input.categoryId || null,
        coverImage: input.coverImage || null,
        allowComment: input.allowComment ?? true,
        showComments: input.showComments ?? true,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
        canonicalUrl: input.canonicalUrl || null,
        publishedAt:
          input.publishedAt || (input.status === 'published' ? new Date().toISOString() : null),
        pinned: input.pinned ?? false,
      })
      .returning(),
  )

  // 保存标签关联
  if (input.tagIds && input.tagIds.length > 0) {
    await db
      .insert(contentTags)
      .values(input.tagIds.map((tagId) => ({ contentId: post.id, tagId })))
  }

  return post
}

/** 更新文章 */
export async function updatePost(
  id: number,
  input: Partial<PostInput>,
  tx: Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'> = db,
) {
  const existing = await maybeFirst(
    tx
      .select()
      .from(contents)
      .where(and(eq(contents.type, 'post'), eq(contents.id, id)))
      .limit(1),
  )
  if (!existing) return null

  // 如果 slug 变更，保存旧 slug 到历史
  if (input.slug && input.slug !== existing.slug && existing.slug) {
    await tx.insert(slugHistories).values({
      contentId: id,
      slug: existing.slug,
    })
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  }

  if (input.title !== undefined) updateData.title = input.title
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.contentType !== undefined) updateData.contentType = input.contentType
  if (input.contentRaw !== undefined) updateData.contentRaw = input.contentRaw
  if (input.contentHtml !== undefined) updateData.contentHtml = input.contentHtml
  if (input.contentText !== undefined) {
    updateData.contentText = input.contentText
    updateData.excerptAuto = input.contentText.substring(0, 200)
  }
  if (input.excerpt !== undefined) updateData.excerpt = input.excerpt || null
  if (input.status !== undefined) {
    updateData.status = input.status
    // 首次发布时设置发布时间
    if (input.status === 'published' && !existing.publishedAt && !input.publishedAt) {
      updateData.publishedAt = new Date().toISOString()
    }
  }
  if (input.publishedAt !== undefined) updateData.publishedAt = input.publishedAt
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId || null
  if (input.coverImage !== undefined) updateData.coverImage = input.coverImage || null
  if (input.allowComment !== undefined) updateData.allowComment = input.allowComment
  if (input.showComments !== undefined) updateData.showComments = input.showComments
  if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle || null
  if (input.seoDescription !== undefined) updateData.seoDescription = input.seoDescription || null
  if (input.canonicalUrl !== undefined) updateData.canonicalUrl = input.canonicalUrl || null
  if (input.pinned !== undefined) updateData.pinned = input.pinned

  const result = await updateOne(
    tx
      .update(contents)
      .set(updateData)
      .where(and(eq(contents.type, 'post'), eq(contents.id, id)))
      .returning(),
  )

  // 更新标签关联
  if (input.tagIds !== undefined) {
    await tx.delete(contentTags).where(eq(contentTags.contentId, id))
    if (input.tagIds.length > 0) {
      await tx.insert(contentTags).values(input.tagIds.map((tagId) => ({ contentId: id, tagId })))
    }
  }

  return result
}

/** 软删除文章 */
export async function deletePost(id: number) {
  const { deleteRevisionsByTarget } = await import('./revisions')
  await db.transaction(async (tx) => {
    await tx
      .update(contents)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(contents.type, 'post'), eq(contents.id, id)))
    await deleteRevisionsByTarget('post', id, tx)
  })
  return { success: true }
}

/** 将到期的定时发布文章自动转为已发布 */
export async function publishScheduledPosts() {
  const now = new Date().toISOString()
  await db
    .update(contents)
    .set({ status: 'published' })
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'scheduled'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      ),
    )
}

/** 校验 slug 格式 */
export function validateSlug(slug: string): { valid: boolean; message?: string } {
  if (!slug) return { valid: false, message: 'Slug 不能为空' }
  if (slug.startsWith('-')) return { valid: false, message: 'Slug 不能以 - 开头' }
  if (slug.endsWith('-')) return { valid: false, message: 'Slug 不能以 - 结尾' }
  return { valid: true }
}

/** 检查 slug 是否可用 */
export async function isSlugAvailable(slug: string, excludeId?: number) {
  const conditions = [
    eq(contents.type, 'post'),
    eq(contents.slug, slug),
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
