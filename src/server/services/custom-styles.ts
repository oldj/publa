import { db } from '@/server/db'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { customStyles } from '@/server/db/schema'
import { isoNow } from '@/server/db/schema/shared'
import { asc, eq, inArray, max } from 'drizzle-orm'

export interface CustomStyleInput {
  name: string
  css?: string
  sortOrder?: number
}

export interface CustomStyleRow {
  id: number
  name: string
  css: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export async function listCustomStyles(): Promise<CustomStyleRow[]> {
  return db
    .select()
    .from(customStyles)
    .orderBy(asc(customStyles.sortOrder), asc(customStyles.id))
}

export async function getCustomStyleById(id: number) {
  return maybeFirst(db.select().from(customStyles).where(eq(customStyles.id, id)).limit(1))
}

export async function createCustomStyle(input: CustomStyleInput) {
  let sortOrder = input.sortOrder
  if (sortOrder === undefined || sortOrder === 0) {
    const [row] = await db.select({ maxOrder: max(customStyles.sortOrder) }).from(customStyles)
    sortOrder = (row?.maxOrder ?? 0) + 1
  }

  const now = isoNow()
  return insertOne(
    db
      .insert(customStyles)
      .values({
        name: input.name,
        css: input.css ?? '',
        sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning(),
  )
}

export async function updateCustomStyle(id: number, input: Partial<CustomStyleInput>) {
  return updateOne(
    db
      .update(customStyles)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.css !== undefined && { css: input.css }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        updatedAt: isoNow(),
      })
      .where(eq(customStyles.id, id))
      .returning(),
  )
}

export async function deleteCustomStyle(id: number) {
  const current = await getCustomStyleById(id)
  if (!current) return { success: false as const, message: '自定义 CSS 不存在' }
  await db.delete(customStyles).where(eq(customStyles.id, id))
  return { success: true as const }
}

export async function reorderCustomStyles(ids: number[]) {
  const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

  const rows = await db
    .select({ id: customStyles.id })
    .from(customStyles)
    .orderBy(asc(customStyles.sortOrder), asc(customStyles.id))

  const existingIds = rows.map((row) => row.id)
  if (
    normalizedIds.length !== existingIds.length ||
    new Set(normalizedIds).size !== normalizedIds.length ||
    normalizedIds.some((id) => !existingIds.includes(id))
  ) {
    throw new Error('Invalid custom style reorder ids')
  }

  for (const [index, id] of normalizedIds.entries()) {
    await db
      .update(customStyles)
      .set({ sortOrder: index + 1 })
      .where(eq(customStyles.id, id))
  }

  return { success: true }
}

/** 按 id 列表查出自定义 CSS，保持输入顺序 */
export async function listCustomStylesByIds(ids: number[]): Promise<CustomStyleRow[]> {
  if (ids.length === 0) return []
  const rows = await db.select().from(customStyles).where(inArray(customStyles.id, ids))
  const map = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => map.get(id)).filter((row): row is CustomStyleRow => Boolean(row))
}
