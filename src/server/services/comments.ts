import { db } from '@/server/db'
import { insertOne, maybeFirst } from '@/server/db/query'
import { comments, contents } from '@/server/db/schema'
import { normalizeExternalUrl } from '@/server/lib/user-content'
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { publishScheduledPosts } from './posts'
import { getSetting } from './settings'

export interface CommentInput {
  contentId: number
  parentId?: number | null
  authorName: string
  authorEmail?: string
  authorWebsite?: string
  content: string
  ipAddress?: string
  userAgent?: string
  userId?: number | null
}

interface CommentContentAccessInput {
  contentId?: number
  slug?: string
}

interface CommentContentAccess {
  content: {
    id: number
    slug: string | null
    status: 'draft' | 'scheduled' | 'published'
    publishedAt: string | null
  }
  isPublic: boolean
}

/** 解析评论目标内容，并判断是否已对前台公开 */
export async function getCommentContentAccess(
  input: CommentContentAccessInput,
): Promise<CommentContentAccess | null> {
  await publishScheduledPosts()

  let content: CommentContentAccess['content'] | null = null

  if (input.contentId) {
    content = await maybeFirst(
      db
        .select({
          id: contents.id,
          slug: contents.slug,
          status: contents.status,
          publishedAt: contents.publishedAt,
        })
        .from(contents)
        .where(
          and(
            eq(contents.id, input.contentId),
            eq(contents.type, 'post'),
            isNull(contents.deletedAt),
          ),
        )
        .limit(1),
    )
  } else if (input.slug) {
    content = await maybeFirst(
      db
        .select({
          id: contents.id,
          slug: contents.slug,
          status: contents.status,
          publishedAt: contents.publishedAt,
        })
        .from(contents)
        .where(
          and(eq(contents.slug, input.slug), eq(contents.type, 'post'), isNull(contents.deletedAt)),
        )
        .limit(1),
    )
  }

  if (!content) return null

  const now = new Date().toISOString()
  const isPublic =
    content.status === 'published' && !!content.publishedAt && content.publishedAt <= now

  return { content, isPublic }
}

/** 提交评论 */
export async function createComment(input: CommentInput) {
  // 校验全局评论开关
  const showCommentsGlobally = (await getSetting('showCommentsGlobally')) !== 'false'
  const enableComment = (await getSetting('enableComment')) !== 'false'
  if (!showCommentsGlobally || !enableComment) {
    return { success: false, message: '该内容不允许评论' }
  }

  // 检查内容是否存在、类型为 post、且允许评论
  const content = await maybeFirst(
    db
      .select()
      .from(contents)
      .where(and(eq(contents.id, input.contentId), eq(contents.type, 'post')))
      .limit(1),
  )
  if (!content || !content.allowComment || !content.showComments || content.deletedAt) {
    return { success: false, message: '该内容不允许评论' }
  }

  // 校验父评论有效性（评论最多嵌套一层，不允许回复子评论）
  if (input.parentId) {
    const parent = await maybeFirst(
      db
        .select({ id: comments.id, contentId: comments.contentId, parentId: comments.parentId })
        .from(comments)
        .where(and(eq(comments.id, input.parentId), isNull(comments.deletedAt)))
        .limit(1),
    )
    if (!parent || parent.contentId !== input.contentId) {
      return { success: false, message: '父评论无效' }
    }
    if (parent.parentId) {
      return { success: false, message: '不允许回复子评论' }
    }
  }

  // 检查是否需要默认审核通过（后续从 settings 读取）
  const status = 'pending' as const

  const row = await insertOne(
    db
      .insert(comments)
      .values({
        contentId: input.contentId,
        parentId: input.parentId || null,
        userId: input.userId || null,
        authorName: input.authorName,
        authorEmail: input.authorEmail || null,
        authorWebsite: normalizeExternalUrl(input.authorWebsite),
        content: input.content,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        status,
      })
      .returning(),
  )

  return { success: true, data: row }
}

/** 获取内容的已审核评论 */
export async function getApprovedComments(contentId: number) {
  return db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.contentId, contentId),
        eq(comments.status, 'approved'),
        isNull(comments.deletedAt),
      ),
    )
    .orderBy(asc(comments.createdAt))
}

/** 列出所有评论（后台管理，含内容标题和作者统计） */
export async function listComments(
  options: {
    page?: number
    pageSize?: number
    status?: string
    contentId?: number
  } = {},
) {
  const { page = 1, pageSize = 20, status, contentId } = options

  const conditions = [isNull(comments.deletedAt)]
  if (status) conditions.push(eq(comments.status, status as any))
  if (contentId) conditions.push(eq(comments.contentId, contentId))

  const where = and(...conditions)

  const [{ total }] = await db.select({ total: count() }).from(comments).where(where)

  const rows = await db
    .select({
      id: comments.id,
      contentId: comments.contentId,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      authorWebsite: comments.authorWebsite,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
      contentTitle: contents.title,
      contentSlug: contents.slug,
    })
    .from(comments)
    .leftJoin(contents, eq(comments.contentId, contents.id))
    .where(where)
    .orderBy(desc(comments.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  // 收集本页所有评论者的 email，批量查询统计
  const emails = [...new Set(rows.map((r) => r.authorEmail).filter(Boolean))] as string[]
  const authorStatsMap: Record<string, { approved: number; rejected: number; total: number }> = {}

  if (emails.length > 0) {
    const stats = await db
      .select({
        authorEmail: comments.authorEmail,
        status: comments.status,
        cnt: count(),
      })
      .from(comments)
      .where(and(inArray(comments.authorEmail, emails), isNull(comments.deletedAt)))
      .groupBy(comments.authorEmail, comments.status)

    for (const stat of stats) {
      if (!stat.authorEmail) continue

      const current = authorStatsMap[stat.authorEmail] || {
        approved: 0,
        rejected: 0,
        total: 0,
      }
      current.total += stat.cnt
      if (stat.status === 'approved') current.approved = stat.cnt
      else if (stat.status === 'rejected') current.rejected = stat.cnt
      authorStatsMap[stat.authorEmail] = current
    }
  }

  // 批量查询子评论数量
  const commentIds = rows.map((r) => r.id)
  const childCountMap: Record<number, number> = {}
  if (commentIds.length > 0) {
    const childCounts = await db
      .select({ parentId: comments.parentId, cnt: count() })
      .from(comments)
      .where(and(inArray(comments.parentId, commentIds), isNull(comments.deletedAt)))
      .groupBy(comments.parentId)
    for (const row of childCounts) {
      if (row.parentId) childCountMap[row.parentId] = row.cnt
    }
  }

  const items = rows.map((r) => ({
    ...r,
    authorStats: r.authorEmail ? authorStatsMap[r.authorEmail] || null : null,
    childCount: childCountMap[r.id] || 0,
  }))

  return {
    items,
    page,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    itemCount: total,
  }
}

/** 获取评论详情（含内容信息和父评论） */
export async function getCommentById(id: number) {
  const comment = await maybeFirst(
    db
      .select({
        id: comments.id,
        contentId: comments.contentId,
        parentId: comments.parentId,
        authorName: comments.authorName,
        authorEmail: comments.authorEmail,
        authorWebsite: comments.authorWebsite,
        content: comments.content,
        ipAddress: comments.ipAddress,
        userAgent: comments.userAgent,
        status: comments.status,
        createdAt: comments.createdAt,
        contentTitle: contents.title,
        contentSlug: contents.slug,
      })
      .from(comments)
      .leftJoin(contents, eq(comments.contentId, contents.id))
      .where(eq(comments.id, id))
      .limit(1),
  )

  if (!comment) return null

  // 获取父评论
  let parentComment = null
  if (comment.parentId) {
    parentComment = await maybeFirst(
      db
        .select({
          id: comments.id,
          authorName: comments.authorName,
          authorEmail: comments.authorEmail,
          content: comments.content,
          status: comments.status,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .where(eq(comments.id, comment.parentId))
        .limit(1),
    )
  }

  // 获取子评论
  const childComments = await db
    .select({
      id: comments.id,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(and(eq(comments.parentId, id), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt))

  return { ...comment, parentComment, childComments }
}

/** 审核评论 */
export async function moderateComment(
  id: number,
  action: 'approved' | 'rejected',
  moderatedBy: number,
) {
  await db
    .update(comments)
    .set({
      status: action,
      moderatedBy,
      moderatedAt: new Date().toISOString(),
    })
    .where(eq(comments.id, id))
  return { success: true }
}

/** 待审核评论数 */
export async function countPendingComments() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(comments)
    .where(and(eq(comments.status, 'pending'), isNull(comments.deletedAt)))
  return total
}

/** 软删除评论（级联删除子评论） */
export async function deleteComment(id: number) {
  const now = new Date().toISOString()
  // 级联软删除子评论
  await db
    .update(comments)
    .set({ deletedAt: now })
    .where(and(eq(comments.parentId, id), isNull(comments.deletedAt)))
  // 删除评论本身
  await db.update(comments).set({ deletedAt: now }).where(eq(comments.id, id))
  return { success: true }
}
