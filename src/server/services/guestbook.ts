import { db } from '@/server/db'
import { insertOne, maybeFirst } from '@/server/db/query'
import { guestbookMessages } from '@/server/db/schema'
import { normalizeExternalUrl } from '@/server/lib/user-content'
import { and, count, desc, eq, isNull } from 'drizzle-orm'

export interface GuestbookInput {
  authorName: string
  authorEmail?: string
  authorWebsite?: string
  content: string
  ipAddress?: string
  userAgent?: string
}

/** 提交留言 */
export async function createGuestbookMessage(input: GuestbookInput) {
  const row = await insertOne(
    db
      .insert(guestbookMessages)
      .values({
        authorName: input.authorName,
        authorEmail: input.authorEmail || null,
        authorWebsite: normalizeExternalUrl(input.authorWebsite),
        content: input.content,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        status: 'unread',
      })
      .returning(),
  )

  return { success: true, data: row }
}

/** 列出所有留言（后台） */
export async function listGuestbookMessages(
  options: {
    page?: number
    pageSize?: number
    status?: string
  } = {},
) {
  const { page = 1, pageSize = 20, status } = options

  const conditions = [isNull(guestbookMessages.deletedAt)]
  if (status) conditions.push(eq(guestbookMessages.status, status as any))

  const where = and(...conditions)

  const [{ total }] = await db.select({ total: count() }).from(guestbookMessages).where(where)

  const rows = await db
    .select()
    .from(guestbookMessages)
    .where(where)
    .orderBy(desc(guestbookMessages.createdAt))
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

/** 获取单条留言 */
export async function getGuestbookMessageById(id: number) {
  return maybeFirst(
    db.select().from(guestbookMessages).where(eq(guestbookMessages.id, id)).limit(1),
  )
}

/** 标记留言为已读 */
export async function markGuestbookMessageRead(id: number) {
  await db.update(guestbookMessages).set({ status: 'read' }).where(eq(guestbookMessages.id, id))
  return { success: true }
}

/** 标记留言为未读 */
export async function markGuestbookMessageUnread(id: number) {
  await db.update(guestbookMessages).set({ status: 'unread' }).where(eq(guestbookMessages.id, id))
  return { success: true }
}

/** 批量标记为已读 */
export async function markAllGuestbookMessagesRead() {
  await db
    .update(guestbookMessages)
    .set({ status: 'read' })
    .where(and(eq(guestbookMessages.status, 'unread'), isNull(guestbookMessages.deletedAt)))
  return { success: true }
}

/** 未读留言数 */
export async function countUnreadGuestbookMessages() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(guestbookMessages)
    .where(and(eq(guestbookMessages.status, 'unread'), isNull(guestbookMessages.deletedAt)))
  return total
}

/** 软删除留言 */
export async function deleteGuestbookMessage(id: number) {
  await db
    .update(guestbookMessages)
    .set({
      deletedAt: new Date().toISOString(),
    })
    .where(eq(guestbookMessages.id, id))
  return { success: true }
}
