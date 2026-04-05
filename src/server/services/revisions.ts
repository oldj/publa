import type { DraftContentType } from '@/shared/revision-metadata'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contentRevisions } from '@/server/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'

type TargetType = 'post' | 'page'
/** 事务或数据库实例，供函数内部统一使用 */
type DbOrTx = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>
type DraftMetadata = object
type RawRevisionRow = typeof contentRevisions.$inferSelect

export interface RevisionContent<TMetadata extends DraftMetadata = DraftMetadata> {
  title: string
  excerpt: string
  contentType?: DraftContentType
  contentRaw: string
  contentHtml: string
  contentText: string
  metadata?: TMetadata
}

export interface RevisionRow<TMetadata extends DraftMetadata = DraftMetadata> extends Omit<
  RawRevisionRow,
  'contentType' | 'metaJson'
> {
  contentType: DraftContentType
  metadata: TMetadata
}

function parseMetadata(metaJson: string): DraftMetadata {
  try {
    const parsed = JSON.parse(metaJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as DraftMetadata
  } catch {
    return {}
  }
}

function serializeMetadata(metadata?: DraftMetadata) {
  return JSON.stringify(metadata ?? {})
}

function normalizeRevisionRow<TMetadata extends DraftMetadata = DraftMetadata>(
  row: RawRevisionRow | null,
): RevisionRow<TMetadata> | null {
  if (!row) return null

  const { metaJson, ...rest } = row

  return {
    ...rest,
    contentType: row.contentType as DraftContentType,
    metadata: parseMetadata(metaJson) as TMetadata,
  }
}

/** 保存草稿（upsert） */
export async function saveDraft<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetId: number,
  content: RevisionContent<TMetadata>,
  userId: number,
  tx: DbOrTx = db,
) {
  const now = new Date().toISOString()
  const payload = {
    title: content.title,
    excerpt: content.excerpt,
    contentType: content.contentType || 'richtext',
    contentRaw: content.contentRaw,
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    metaJson: serializeMetadata(content.metadata),
  }

  const existingRow = await maybeFirst(
    tx
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
    await tx
      .update(contentRevisions)
      .set({
        ...payload,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(contentRevisions.id, existingRow.id))

    return { updatedAt: now }
  }

  await tx.insert(contentRevisions).values({
    targetType,
    targetId,
    ...payload,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
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
export async function getDraft<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetId: number,
  tx: DbOrTx = db,
) {
  const row = await maybeFirst(
    tx
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

  return normalizeRevisionRow<TMetadata>(row)
}

/** 批量获取草稿，供后台列表叠加展示 */
export async function listDraftsByTargetIds<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetIds: number[],
) {
  if (targetIds.length === 0) return [] as RevisionRow<TMetadata>[]

  const rows = await db
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.targetType, targetType),
        inArray(contentRevisions.targetId, targetIds),
        eq(contentRevisions.status, 'draft'),
      ),
    )

  return rows
    .map((row) => normalizeRevisionRow<TMetadata>(row))
    .filter((row): row is RevisionRow<TMetadata> => row !== null)
}

/** 发布草稿：将草稿冻结为历史版本 */
export async function publishDraft<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetId: number,
  tx: DbOrTx = db,
) {
  const now = new Date().toISOString()

  const draft = await getDraft<TMetadata>(targetType, targetId, tx)
  if (!draft) return null

  await tx
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
export async function getRevisionById<TMetadata extends DraftMetadata = DraftMetadata>(id: number) {
  const row = await maybeFirst(
    db.select().from(contentRevisions).where(eq(contentRevisions.id, id)).limit(1),
  )

  return normalizeRevisionRow<TMetadata>(row)
}

/** 批量删除已发布版本（限定 target 范围） */
export async function deleteRevisions(targetType: TargetType, targetId: number, ids: number[]) {
  if (ids.length === 0) return 0

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
export async function restoreRevision<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetId: number,
  revisionId: number,
  userId: number,
  tx: DbOrTx = db,
) {
  const source = await getRevisionById<TMetadata>(revisionId)
  if (!source || source.targetType !== targetType || source.targetId !== targetId) {
    return null
  }

  const content: RevisionContent<TMetadata> = {
    title: source.title,
    excerpt: source.excerpt,
    contentType: source.contentType,
    contentRaw: source.contentRaw,
    contentHtml: source.contentHtml,
    contentText: source.contentText,
    metadata: source.metadata,
  }

  await saveDraft(targetType, targetId, content, userId, tx)
  const published = await publishDraft<TMetadata>(targetType, targetId, tx)
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
