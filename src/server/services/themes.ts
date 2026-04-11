import { db } from '@/server/db'
import { isoNow } from '@/server/db/schema/shared'
import { insertOne, maybeFirst, updateOne } from '@/server/db/query'
import { themes } from '@/server/db/schema'
import { buildZip, parseZip } from '@/server/lib/zip'
import { getSetting } from '@/server/services/settings'
import { asc, eq, max } from 'drizzle-orm'

export interface ThemeInput {
  name: string
  css?: string
  sortOrder?: number
}

export interface ThemeRow {
  id: number
  name: string
  css: string
  sortOrder: number
  builtinKey: string | null
  createdAt: string
  updatedAt: string
}

/** 查询所有主题（内置 + 自定义），按排序字段升序 */
export async function listThemes(): Promise<ThemeRow[]> {
  return db
    .select()
    .from(themes)
    .orderBy(asc(themes.sortOrder), asc(themes.id))
}

export async function getThemeById(id: number) {
  return maybeFirst(db.select().from(themes).where(eq(themes.id, id)).limit(1))
}

export async function createTheme(input: ThemeInput) {
  let sortOrder = input.sortOrder
  if (sortOrder === undefined || sortOrder === 0) {
    const [row] = await db.select({ maxOrder: max(themes.sortOrder) }).from(themes)
    sortOrder = (row?.maxOrder ?? 0) + 1
  }

  const now = isoNow()
  return insertOne(
    db
      .insert(themes)
      .values({
        name: input.name,
        css: input.css ?? '',
        sortOrder,
        builtinKey: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning(),
  )
}

export class BuiltinThemeError extends Error {
  constructor(message = '内置主题不可修改或删除') {
    super(message)
    this.name = 'BuiltinThemeError'
  }
}

export class ActiveThemeError extends Error {
  constructor(message = '无法删除当前正在使用的主题，请先切换到其他主题') {
    super(message)
    this.name = 'ActiveThemeError'
  }
}

export async function updateTheme(id: number, input: Partial<ThemeInput>) {
  const current = await getThemeById(id)
  if (!current) return null
  if (current.builtinKey) {
    throw new BuiltinThemeError()
  }

  return updateOne(
    db
      .update(themes)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.css !== undefined && { css: input.css }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        updatedAt: isoNow(),
      })
      .where(eq(themes.id, id))
      .returning(),
  )
}

export async function deleteTheme(id: number) {
  const current = await getThemeById(id)
  if (!current) return { success: false as const, message: '主题不存在' }
  if (current.builtinKey) {
    throw new BuiltinThemeError()
  }
  // 禁止删除当前生效主题，避免前台进入无主题状态
  const activeThemeId = await getSetting('activeThemeId')
  if (typeof activeThemeId === 'number' && activeThemeId === id) {
    throw new ActiveThemeError()
  }
  await db.delete(themes).where(eq(themes.id, id))
  return { success: true as const }
}

/**
 * 按 id 列表导出自定义主题为 zip（Uint8Array）。
 * 只导出 builtinKey === null 的主题；未匹配到的 id 静默忽略。
 * 保持 ids 参数传入的顺序。
 */
export async function exportThemesAsZip(ids: number[]): Promise<Uint8Array> {
  const all = await listThemes()
  const byId = new Map(all.map((row) => [row.id, row]))
  const entries: { name: string; content: string }[] = []
  for (const id of ids) {
    const row = byId.get(id)
    if (!row) continue
    if (row.builtinKey) continue
    entries.push({ name: row.name, content: row.css ?? '' })
  }
  if (entries.length === 0) return new Uint8Array()
  return buildZip(entries)
}

/**
 * 从 zip buffer 中读出所有合法的 .css 条目并追加为新主题。
 * 导入总是追加，不合并同名项。
 */
export async function importThemesFromZip(
  buffer: Uint8Array,
): Promise<{ imported: number; skipped: number }> {
  const { entries, skipped } = parseZip(buffer)
  let imported = 0
  for (const entry of entries) {
    await createTheme({ name: entry.name, css: entry.content })
    imported++
  }
  return { imported, skipped }
}

/** 批量更新主题排序（允许包含内置主题） */
export async function reorderThemes(ids: number[]) {
  const normalizedIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)

  const rows = await db
    .select({ id: themes.id })
    .from(themes)
    .orderBy(asc(themes.sortOrder), asc(themes.id))

  const existingIds = rows.map((row) => row.id)
  if (
    normalizedIds.length !== existingIds.length ||
    new Set(normalizedIds).size !== normalizedIds.length ||
    normalizedIds.some((id) => !existingIds.includes(id))
  ) {
    throw new Error('Invalid theme reorder ids')
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of normalizedIds.entries()) {
      await tx
        .update(themes)
        .set({ sortOrder: index + 1 })
        .where(eq(themes.id, id))
    }
  })

  return { success: true }
}
