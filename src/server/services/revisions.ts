import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contentRevisions } from '@/server/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

type TargetType = 'post' | 'page'

interface RevisionContent {
  title: string
  excerpt: string
  contentType?: 'richtext' | 'markdown' | 'html'
  contentRaw: string
  contentHtml: string
  contentText: string
}

/** 保存草稿（upsert） */
export async function saveDraft(
  targetType: TargetType,
  targetId: number,
  content: RevisionContent,
  userId: number,
) {
  const now = new Date().toISOString()

  const existingRow = await maybeFirst(
    db
      .select({ id: contentRevisions.id })
      .from(contentRevisions)
      .where(
        and(
          eq(contentRevisions.targetType, targetType),
          eq(contentRevisions.targetId, targetId),
          eq(contentRevisions.status, 'draft'),
        ),
      )
      .limit(1),
  )

  if (existingRow) {
    await db
      .update(contentRevisions)
      .set({
        ...content,
        updatedAt: now,
        createdBy: userId,
      })
      .where(eq(contentRevisions.id, existingRow.id))

    return { updatedAt: now }
  }

  await db.insert(contentRevisions).values({
    targetType,
    targetId,
    ...content,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  })

  return { updatedAt: now }
}

/** 删除草稿 */
export async function deleteDraft(targetType: TargetType, targetId: number) {
  await db
    .delete(contentRevisions)
    .where(
      and(
        eq(contentRevisions.targetType, targetType),
        eq(contentRevisions.targetId, targetId),
        eq(contentRevisions.status, 'draft'),
      ),
    )
}

/** 获取草稿 */
export async function getDraft(targetType: TargetType, targetId: number) {
  return maybeFirst(
    db
      .select()
      .from(contentRevisions)
      .where(
        and(
          eq(contentRevisions.targetType, targetType),
          eq(contentRevisions.targetId, targetId),
          eq(contentRevisions.status, 'draft'),
        ),
      )
      .limit(1),
  )
}

/** 发布草稿：将草稿冻结为历史版本 */
export async function publishDraft(targetType: TargetType, targetId: number) {
  const now = new Date().toISOString()

  const draft = await getDraft(targetType, targetId)
  if (!draft) return null

  await db
    .update(contentRevisions)
    .set({
      status: 'published',
      updatedAt: now,
    })
    .where(eq(contentRevisions.id, draft.id))

  return { ...draft, status: 'published', updatedAt: now }
}

/** 列出历史版本（不含内容，仅元数据） */
export async function listPublishedRevisions(targetType: TargetType, targetId: number) {
  return db
    .select({
      id: contentRevisions.id,
      title: contentRevisions.title,
      updatedAt: contentRevisions.updatedAt,
      createdBy: contentRevisions.createdBy,
    })
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.targetType, targetType),
        eq(contentRevisions.targetId, targetId),
        eq(contentRevisions.status, 'published'),
      ),
    )
    .orderBy(desc(contentRevisions.updatedAt))
}

/** 获取单条修订（含内容） */
export async function getRevisionById(id: number) {
  return maybeFirst(db.select().from(contentRevisions).where(eq(contentRevisions.id, id)).limit(1))
}

/** 批量删除已发布版本（限定 target 范围） */
export async function deleteRevisions(targetType: TargetType, targetId: number, ids: number[]) {
  if (ids.length === 0) return 0

  // 只删除指定 target 的已发布版本，不允许删除草稿
  const result = await db
    .delete(contentRevisions)
    .returning({ id: contentRevisions.id })
    .where(
      and(
        inArray(contentRevisions.id, ids),
        eq(contentRevisions.targetType, targetType),
        eq(contentRevisions.targetId, targetId),
        eq(contentRevisions.status, 'published'),
      ),
    )

  return result.length
}

/** 恢复版本：用历史内容创建草稿并立即发布 */
export async function restoreRevision(
  targetType: TargetType,
  targetId: number,
  revisionId: number,
  userId: number,
) {
  const source = await getRevisionById(revisionId)
  if (!source || source.targetType !== targetType || source.targetId !== targetId) {
    return null
  }

  const content: RevisionContent = {
    title: source.title,
    excerpt: source.excerpt,
    contentType: source.contentType as 'richtext' | 'markdown' | 'html',
    contentRaw: source.contentRaw,
    contentHtml: source.contentHtml,
    contentText: source.contentText,
  }

  // 保存为草稿，再立即发布
  await saveDraft(targetType, targetId, content, userId)
  const published = await publishDraft(targetType, targetId)

  return { revision: published, content }
}

/** 删除某 target 的所有修订 */
export async function deleteRevisionsByTarget(targetType: TargetType, targetId: number) {
  await db
    .delete(contentRevisions)
    .where(
      and(eq(contentRevisions.targetType, targetType), eq(contentRevisions.targetId, targetId)),
    )
}
