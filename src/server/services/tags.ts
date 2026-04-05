import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { tags, contentTags, contents } from '@/server/db/schema'
import { eq, count, and, isNull, asc } from 'drizzle-orm'

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

/** 查询所有标签（含文章计数） */
export async function listTags(): Promise<TagWithCount[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      seoTitle: tags.seoTitle,
      seoDescription: tags.seoDescription,
      postCount: count(contents.id),
    })
    .from(tags)
    .leftJoin(contentTags, eq(contentTags.tagId, tags.id))
    .leftJoin(
      contents,
      and(
        eq(contents.id, contentTags.contentId),
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        isNull(contents.deletedAt),
      ),
    )
    .groupBy(tags.id)
    .orderBy(asc(tags.id))

  return rows
}

/** 通过 ID 获取标签 */
export async function getTagById(id: number) {
  return maybeFirst(
    db.select().from(tags).where(eq(tags.id, id)).limit(1),
  )
}

/** 通过 slug 获取标签 */
export async function getTagBySlug(slug: string) {
  return maybeFirst(
    db.select().from(tags).where(eq(tags.slug, slug)).limit(1),
  )
}

/** 创建标签 */
export async function createTag(input: TagInput) {
  return insertOne(db.insert(tags).values({
    name: input.name,
    slug: input.slug,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  }).returning())
}

/** 更新标签 */
export async function updateTag(id: number, input: Partial<TagInput>) {
  return updateOne(db.update(tags).set({
    ...(input.name !== undefined && { name: input.name }),
    ...(input.slug !== undefined && { slug: input.slug }),
    ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle || null }),
    ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription || null }),
  }).where(eq(tags.id, id)).returning())
}

/** 删除标签 */
export async function deleteTag(id: number) {
  // 先删除关联
  await db.delete(contentTags).where(eq(contentTags.tagId, id))
  await db.delete(tags).where(eq(tags.id, id))
  return { success: true }
}
