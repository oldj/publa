import { db } from '@/server/db'
import { insertOne, updateOne } from '@/server/db/query'
import { menus } from '@/server/db/schema'
import { asc, eq } from 'drizzle-orm'

export interface MenuInput {
  title: string
  url?: string
  parentId?: number | null
  sortOrder?: number
  target?: '_self' | '_blank'
}

/** 获取所有菜单（按 sortOrder 排序） */
export async function listMenus() {
  return db.select().from(menus).orderBy(asc(menus.sortOrder), asc(menus.id))
}

/** 获取菜单树（前台用） */
export async function getMenuTree() {
  const all = await listMenus()

  const topLevel = all.filter((m) => !m.parentId)
  return topLevel.map((menu) => ({
    ...menu,
    children: all.filter((m) => m.parentId === menu.id),
  }))
}

/** 创建菜单 */
export async function createMenu(input: MenuInput) {
  return insertOne(
    db
      .insert(menus)
      .values({
        title: input.title,
        url: input.url || '',
        parentId: input.parentId || null,
        sortOrder: input.sortOrder ?? 0,
        target: input.target || '_self',
      })
      .returning(),
  )
}

/** 更新菜单 */
export async function updateMenu(id: number, input: Partial<MenuInput>) {
  const updateData: Record<string, any> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.url !== undefined) updateData.url = input.url
  if (input.parentId !== undefined) updateData.parentId = input.parentId || null
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder
  if (input.target !== undefined) updateData.target = input.target

  return updateOne(db.update(menus).set(updateData).where(eq(menus.id, id)).returning())
}

/** 删除菜单 */
export async function deleteMenu(id: number) {
  // 同时删除子菜单
  await db.delete(menus).where(eq(menus.parentId, id))
  await db.delete(menus).where(eq(menus.id, id))
  return { success: true }
}

/** 批量更新菜单排序 */
export async function reorderMenus(items: { id: number; sortOrder: number }[]) {
  for (const item of items) {
    await db.update(menus).set({ sortOrder: item.sortOrder }).where(eq(menus.id, item.id))
  }
  return { success: true }
}

/** 恢复默认菜单 */
export async function resetMenus() {
  await db.delete(menus)
  const defaults = [
    { title: '首页', url: '/', sortOrder: 0, target: '_self' as const },
    { title: '文章', url: '/posts', sortOrder: 1, target: '_self' as const },
    { title: '留言', url: '/guestbook', sortOrder: 2, target: '_self' as const },
    { title: '关于', url: '/about', sortOrder: 3, target: '_self' as const },
  ]
  await db.insert(menus).values(defaults)
  return { success: true }
}
