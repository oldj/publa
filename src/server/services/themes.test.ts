import * as schema from '@/server/db/schema'
import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  ActiveThemeError,
  BuiltinThemeError,
  createTheme,
  deleteTheme,
  getThemeById,
  listThemes,
  reorderThemes,
  updateTheme,
} = await import('./themes')
const { setSetting } = await import('./settings')

async function seedBuiltinThemes() {
  await testDb.insert(schema.themes).values([
    { id: 1, name: '浅色', css: '', sortOrder: 1, builtinKey: 'light' },
    { id: 2, name: '深色', css: '', sortOrder: 2, builtinKey: 'dark' },
    { id: 3, name: '空白', css: '', sortOrder: 3, builtinKey: 'blank' },
  ])
}

beforeEach(async () => {
  await setupTestDb()
  await seedBuiltinThemes()
})

describe('getThemeById', () => {
  it('id 不存在时返回 null（与 custom-styles 保持一致）', async () => {
    expect(await getThemeById(99999)).toBeNull()
  })

  it('返回对应主题记录', async () => {
    const row = await getThemeById(1)
    expect(row?.builtinKey).toBe('light')
  })
})

describe('listThemes', () => {
  it('按 sortOrder 升序返回所有主题', async () => {
    const a = await createTheme({ name: 'A', css: '' })
    const b = await createTheme({ name: 'B', css: '' })
    const rows = await listThemes()
    // 3 个内置 + 2 个自定义，按 sortOrder 升序
    expect(rows.map((t) => t.name)).toEqual(['浅色', '深色', '空白', 'A', 'B'])
    expect(rows.find((t) => t.id === a!.id)?.sortOrder).toBe(4)
    expect(rows.find((t) => t.id === b!.id)?.sortOrder).toBe(5)
  })
})

describe('createTheme', () => {
  it('缺省 sortOrder 时自动取当前最大值 +1', async () => {
    const a = await createTheme({ name: 'A', css: 'body{}' })
    expect(a!.sortOrder).toBe(4)
    const b = await createTheme({ name: 'B', css: '' })
    expect(b!.sortOrder).toBe(5)
  })

  it('builtinKey 固定为 null', async () => {
    const row = await createTheme({ name: 'X', css: '' })
    expect(row!.builtinKey).toBeNull()
  })
})

describe('updateTheme', () => {
  it('更新 name / css / sortOrder', async () => {
    const created = await createTheme({ name: '原名', css: 'a{}' })
    const updated = await updateTheme(created!.id, {
      name: '新名',
      css: 'b{}',
      sortOrder: 99,
    })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('新名')
    expect(updated!.css).toBe('b{}')
    expect(updated!.sortOrder).toBe(99)
  })

  it('目标 id 不存在时返回 null', async () => {
    const result = await updateTheme(99999, { name: 'X' })
    expect(result).toBeNull()
  })

  it('拒绝修改内置主题', async () => {
    await expect(updateTheme(1, { name: '改名' })).rejects.toBeInstanceOf(BuiltinThemeError)
    const stillLight = await getThemeById(1)
    expect(stillLight?.name).toBe('浅色')
  })
})

describe('deleteTheme', () => {
  it('可以删除普通自定义主题', async () => {
    const created = await createTheme({ name: '测试', css: '' })
    const result = await deleteTheme(created!.id)
    expect(result.success).toBe(true)

    const rows = await testDb.select().from(schema.themes)
    expect(rows.find((t) => t.id === created!.id)).toBeUndefined()
  })

  it('id 不存在时返回 success:false', async () => {
    const result = await deleteTheme(99999)
    expect(result.success).toBe(false)
  })

  it('拒绝删除内置主题', async () => {
    await expect(deleteTheme(1)).rejects.toBeInstanceOf(BuiltinThemeError)
  })

  it('拒绝删除当前生效主题', async () => {
    const created = await createTheme({ name: '生效中', css: '' })
    await setSetting('activeThemeId', created!.id)

    await expect(deleteTheme(created!.id)).rejects.toBeInstanceOf(ActiveThemeError)

    const rows = await testDb.select().from(schema.themes)
    expect(rows.find((t) => t.id === created!.id)).toBeDefined()
  })

  it('切换走之后可以删除', async () => {
    const a = await createTheme({ name: 'A', css: '' })
    const b = await createTheme({ name: 'B', css: '' })
    await setSetting('activeThemeId', a!.id)
    await setSetting('activeThemeId', b!.id)

    const result = await deleteTheme(a!.id)
    expect(result.success).toBe(true)
  })
})

describe('reorderThemes', () => {
  it('按传入顺序重写 sortOrder', async () => {
    const a = await createTheme({ name: 'A', css: '' })
    const b = await createTheme({ name: 'B', css: '' })

    // 把 B 排到最前面
    await reorderThemes([b!.id, 1, 2, 3, a!.id])

    const rows = await testDb
      .select()
      .from(schema.themes)
      .orderBy(asc(schema.themes.sortOrder))
    expect(rows.map((t) => t.id)).toEqual([b!.id, 1, 2, 3, a!.id])
  })

  it('id 列表与数据库不一致时抛错', async () => {
    await createTheme({ name: 'A', css: '' })
    // 少了一项
    await expect(reorderThemes([1, 2, 3])).rejects.toThrow()
    // 重复项
    await expect(reorderThemes([1, 1, 2, 3])).rejects.toThrow()
    // 含未知 id
    await expect(reorderThemes([1, 2, 3, 99999])).rejects.toThrow()
  })
})
