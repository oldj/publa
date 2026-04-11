import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { contentTags, tags } from '@/server/db/schema'
import { asc, eq } from 'drizzle-orm'

export interface TagInput {
  name: string
  slug: string
  seoTitle?: string
  seoDescription?: string
}

export interface TagWithCount {
  id: number
  name: string
  slug: string
  seoTitle: string | null
  seoDescription: string | null
  postCount: number
}

/** 查询所有标签（含文章计数，读取缓存字段） */
export async function listTags(): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      seoTitle: tags.seoTitle,
      seoDescription: tags.seoDescription,
      postCount: tags.postCount,
    })
    .from(tags)
    .orderBy(asc(tags.id))

  return rows
}

/** 通过 ID 获取标签 */
export async function getTagById(id: number) {
  return maybeFirst(db.select().from(tags).where(eq(tags.id, id)).limit(1))
}

/** 通过 slug 获取标签 */
export async function getTagBySlug(slug: string) {
  return maybeFirst(db.select().from(tags).where(eq(tags.slug, slug)).limit(1))
}

function buildTagSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** 创建标签 */
export async function createTag(input: TagInput) {
  return insertOne(
    db
      .insert(tags)
      .values({
        name: input.name,
        slug: input.slug,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      })
      .returning(),
  )
}

/** 更新标签 */
export async function updateTag(id: number, input: Partial<TagInput>) {
  return updateOne(
    db
      .update(tags)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle || null }),
        ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription || null }),
      })
      .where(eq(tags.id, id))
      .returning(),
  )
}

/** 删除标签 */
export async function deleteTag(id: number) {
  await db.transaction(async (tx) => {
    await tx.delete(contentTags).where(eq(contentTags.tagId, id))
    await tx.delete(tags).where(eq(tags.id, id))
  })
  return { success: true }
}

/** 根据标签名查找或创建标签，并返回对应 ID */
export async function ensureTagIdsByNames(
  names: string[],
  conn: Pick<typeof db, 'select' | 'insert'> = db,
) {
  const tagIds: number[] = []

  for (const rawName of names) {
    const name = rawName.trim()
    if (!name) continue

    const existing = await maybeFirst(conn.select().from(tags).where(eq(tags.name, name)).limit(1))
    if (existing) {
      tagIds.push(existing.id)
      continue
    }

    const created = await insertOne(
      conn
        .insert(tags)
        .values({
          name,
          slug: buildTagSlug(name),
        })
        .returning(),
    )
    tagIds.push(created.id)
  }

  return tagIds
}
