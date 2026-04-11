import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { categories, contents } from '@/server/db/schema'
import { and, asc, count, eq, isNull, max } from 'drizzle-orm'

export interface CategoryInput {
  name: string
  slug: string
  description?: string
  sortOrder?: number
  seoTitle?: string
  seoDescription?: string
}

export interface CategoryWithCount {
  id: number
  name: string
  slug: string
  description: string | null
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
  postCount: number
}

/** 查询所有分类（含文章计数，读取缓存字段） */
export async function listCategories(): Promise<CategoryWithCount[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      sortOrder: categories.sortOrder,
      seoTitle: categories.seoTitle,
      seoDescription: categories.seoDescription,
      postCount: categories.postCount,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id))

  return rows
}

/** 通过 ID 获取分类 */
export async function getCategoryById(id: number) {
  return maybeFirst(db.select().from(categories).where(eq(categories.id, id)).limit(1))
}

/** 通过 slug 获取分类 */
export async function getCategoryBySlug(slug: string) {
  return maybeFirst(db.select().from(categories).where(eq(categories.slug, slug)).limit(1))
}

/** 创建分类 */
export async function createCategory(input: CategoryInput) {
  let sortOrder = input.sortOrder
  if (sortOrder === undefined || sortOrder === 0) {
    // 新分类默认排在末尾
    const [row] = await db.select({ maxOrder: max(categories.sortOrder) }).from(categories)
    sortOrder = (row?.maxOrder ?? 0) + 1
  }

  return insertOne(
    db
      .insert(categories)
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        sortOrder,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      })
      .returning(),
  )
}

/** 更新分类 */
export async function updateCategory(id: number, input: Partial<CategoryInput>) {
  return updateOne(
    db
      .update(categories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle || null }),
        ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription || null }),
      })
      .where(eq(categories.id, id))
      .returning(),
  )
}

/** 批量更新分类排序 */
export async function reorderCategories(ids: number[]) {
  const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id))

  const existingIds = rows.map((row) => row.id)
  if (
    normalizedIds.length !== existingIds.length ||
    new Set(normalizedIds).size !== normalizedIds.length ||
    normalizedIds.some((id) => !existingIds.includes(id))
  ) {
    throw new Error('Invalid category reorder ids')
  }

  for (const [index, id] of normalizedIds.entries()) {
    await db
      .update(categories)
      .set({ sortOrder: index + 1 })
      .where(eq(categories.id, id))
  }

  return { success: true }
}

/** 删除分类（仅当无文章引用时） */
export async function deleteCategory(id: number): Promise<{ success: boolean; message?: string }> {
  const [ref] = await db
    .select({ value: count() })
    .from(contents)
    .where(and(eq(contents.categoryId, id), eq(contents.type, 'post'), isNull(contents.deletedAt)))

  if (ref.value > 0) {
    return { success: false, message: `该分类下仍有 ${ref.value} 篇文章，无法删除` }
  }

  await db.delete(categories).where(eq(categories.id, id))
  return { success: true }
}
