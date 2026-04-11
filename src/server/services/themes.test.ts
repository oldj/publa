import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { ActiveThemeError, BuiltinThemeError, createTheme, deleteTheme } = await import('./themes')
const { setSetting } = await import('./settings')

describe('deleteTheme', () => {
  beforeEach(async () => {
    await setupTestDb()
    // 准备一个内置 light 主题，供 active 引用
    await testDb.insert(schema.themes).values([
      { id: 1, name: '浅色', css: '', sortOrder: 1, builtinKey: 'light' },
    ])
  })

  it('可以删除普通自定义主题', async () => {
    const created = await createTheme({ name: '测试主题', css: 'body{}' })
    const result = await deleteTheme(created!.id)
    expect(result.success).toBe(true)

    const rows = await testDb.select().from(schema.themes)
    expect(rows.find((t) => t.id === created!.id)).toBeUndefined()
  })

  it('拒绝删除内置主题', async () => {
    await expect(deleteTheme(1)).rejects.toBeInstanceOf(BuiltinThemeError)
  })

  it('拒绝删除当前生效主题', async () => {
    const created = await createTheme({ name: '生效中', css: '' })
    await setSetting('activeThemeId', created!.id)

    await expect(deleteTheme(created!.id)).rejects.toBeInstanceOf(ActiveThemeError)

    // 主题应仍然存在
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
