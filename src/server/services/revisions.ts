import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contentRevisions, contents } from '@/server/db/schema'
import type { DraftContentType } from '@/shared/revision-metadata'
import { and, desc, eq, inArray, notExists, sql } from 'drizzle-orm'

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

/** 判断是否应将当前草稿冻结为快照 */
async function shouldCreateSnapshot(
  targetType: TargetType,
  targetId: number,
  newContentRaw: string,
  tx: DbOrTx,
): Promise<boolean> {
  const latest = await maybeFirst(
    tx
      .select({
        updatedAt: contentRevisions.updatedAt,
        contentRaw: contentRevisions.contentRaw,
      })
      .from(contentRevisions)
      .where(
        and(
          eq(contentRevisions.targetType, targetType),
          eq(contentRevisions.targetId, targetId),
          inArray(contentRevisions.status, ['snapshot', 'published']),
        ),
      )
      .orderBy(desc(contentRevisions.updatedAt))
      .limit(1),
  )

  // 从未有过版本
  if (!latest) return true

  // 距上个版本超过 10 分钟
  if (Date.now() - new Date(latest.updatedAt).getTime() > 10 * 60 * 1000) return true

  // 内容长度变化超过 500 字符
  if (Math.abs(newContentRaw.length - latest.contentRaw.length) > 500) return true

  return false
}

/** 保存草稿（upsert），满足条件时自动创建快照 */
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
    const needSnapshot = await shouldCreateSnapshot(targetType, targetId, content.contentRaw, tx)

    if (needSnapshot) {
      // 冻结旧草稿 + 插入新草稿必须原子执行，防止中间态丢失 draft
      const doSnapshot = async (t: DbOrTx) => {
        await t
          .update(contentRevisions)
          .set({ status: 'snapshot', updatedAt: now })
          .where(eq(contentRevisions.id, existingRow.id))

        await t.insert(contentRevisions).values({
          targetType,
          targetId,
          ...payload,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        })
      }

      // 调用方已提供事务则直接执行，否则自行包裹事务
      if (tx === db) {
        await db.transaction((t) => doSnapshot(t))
      } else {
        await doSnapshot(tx)
      }
    } else {
      await tx
        .update(contentRevisions)
        .set({
          ...payload,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(contentRevisions.id, existingRow.id))
    }

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
  userId: number,
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
      updatedBy: userId,
    })
    .where(eq(contentRevisions.id, draft.id))

  return { ...draft, status: 'published', updatedAt: now }
}

/** 列出历史版本（不含内容，仅元数据；包含发布版本和草稿快照） */
export async function listPublishedRevisions(targetType: TargetType, targetId: number) {
  return db
    .select({
      id: contentRevisions.id,
      title: contentRevisions.title,
      status: contentRevisions.status,
      contentRawSize: sql<number>`length(${contentRevisions.contentRaw})`.as('content_raw_size'),
      updatedAt: contentRevisions.updatedAt,
      createdBy: contentRevisions.createdBy,
    })
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.targetType, targetType),
        eq(contentRevisions.targetId, targetId),
        inArray(contentRevisions.status, ['published', 'snapshot']),
      ),
    )
    .orderBy(desc(contentRevisions.updatedAt))
}

/** 获取单条修订（含内容） */
export async function getRevisionById<TMetadata extends DraftMetadata = DraftMetadata>(
  id: number,
  tx: DbOrTx = db,
) {
  const row = await maybeFirst(
    tx.select().from(contentRevisions).where(eq(contentRevisions.id, id)).limit(1),
  )

  return normalizeRevisionRow<TMetadata>(row)
}

/** 批量删除已发布版本或快照（限定 target 范围，不允许删除当前草稿） */
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
        inArray(contentRevisions.status, ['published', 'snapshot']),
      ),
    )

  return result.length
}

/** 恢复版本：用历史内容创建草稿 */
export async function restoreRevision<TMetadata extends DraftMetadata = DraftMetadata>(
  targetType: TargetType,
  targetId: number,
  revisionId: number,
  userId: number,
  tx: DbOrTx = db,
) {
  const source = await getRevisionById<TMetadata>(revisionId, tx)
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
  const draft = await getDraft<TMetadata>(targetType, targetId, tx)
  return { revision: draft, content }
}

/** 删除某 target 的所有修订 */
export async function deleteRevisionsByTarget(
  targetType: TargetType,
  targetId: number,
  tx: DbOrTx = db,
) {
  await tx
    .delete(contentRevisions)
    .where(
      and(eq(contentRevisions.targetType, targetType), eq(contentRevisions.targetId, targetId)),
    )
}

/** 清理孤儿 revision：对应的 content 不存在或已软删除 */
export async function cleanOrphanRevisions() {
  const result = await db
    .delete(contentRevisions)
    .returning({ id: contentRevisions.id })
    .where(
      notExists(
        db
          .select({ id: contents.id })
          .from(contents)
          .where(
            and(
              eq(contents.id, contentRevisions.targetId),
              eq(contents.type, contentRevisions.targetType),
            ),
          ),
      ),
    )

  return result.length
}
