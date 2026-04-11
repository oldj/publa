import * as schema from '@/server/db/schema'
import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  ActiveThemeError,
  BuiltinThemeError,
  createTheme,
  deleteTheme,
  exportThemesAsZip,
  getThemeById,
  importThemesFromZip,
  listThemes,
  reorderThemes,
  updateTheme,
} = await import('./themes')
const { setSetting } = await import('./settings')
const { buildZip, parseZip } = await import('@/server/lib/zip')

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

describe('exportThemesAsZip', () => {
  it('过滤掉内置主题，只导出自定义主题', async () => {
    const a = await createTheme({ name: 'A', css: 'a{}' })
    const b = await createTheme({ name: 'B', css: 'b{}' })
    // 传入内置主题 id 也应被过滤
    const buf = await exportThemesAsZip([1, 2, 3, a!.id, b!.id])
    const { entries } = parseZip(buf)
    expect(entries.map((e) => e.name).sort()).toEqual(['A', 'B'])
  })

  it('保持 ids 传入顺序', async () => {
    const a = await createTheme({ name: 'A', css: 'a{}' })
    const b = await createTheme({ name: 'B', css: 'b{}' })
    const c = await createTheme({ name: 'C', css: 'c{}' })
    const buf = await exportThemesAsZip([c!.id, a!.id, b!.id])
    // 解压后顺序由 fflate 维持插入顺序
    const raw = (await import('fflate')).unzipSync(buf)
    expect(Object.keys(raw)).toEqual(['C.css', 'A.css', 'B.css'])
  })

  it('未匹配到的 id 静默忽略', async () => {
    const a = await createTheme({ name: 'A', css: 'a{}' })
    const buf = await exportThemesAsZip([a!.id, 99999])
    const { entries } = parseZip(buf)
    expect(entries.map((e) => e.name)).toEqual(['A'])
  })

  it('没有任何可导出项时返回空 Uint8Array', async () => {
    // 只传内置主题 id
    const buf = await exportThemesAsZip([1, 2, 3])
    expect(buf.byteLength).toBe(0)

    // 完全不存在的 id
    const buf2 = await exportThemesAsZip([99999])
    expect(buf2.byteLength).toBe(0)
  })

  it('content 字段保留原主题 css 原文', async () => {
    const css = 'body { color: #f00; }\n.title { font-weight: bold; }'
    const a = await createTheme({ name: '红色', css })
    const buf = await exportThemesAsZip([a!.id])
    const { entries } = parseZip(buf)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('红色')
    expect(entries[0].content).toBe(css)
  })
})

describe('importThemesFromZip', () => {
  it('导入与已有记录同名时直接新增（追加，不覆盖）', async () => {
    const existing = await createTheme({ name: 'foo', css: 'old{}' })
    const buf = buildZip([{ name: 'foo', content: 'new{}' }])
    const result = await importThemesFromZip(buf)
    expect(result.imported).toBe(1)

    const rows = (await listThemes()).filter((t) => t.name === 'foo')
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === existing!.id)?.css).toBe('old{}')
    expect(rows.find((r) => r.id !== existing!.id)?.css).toBe('new{}')
  })

  it('zip 内重名条目被 zip 层去重后都能导入', async () => {
    const buf = buildZip([
      { name: 'foo', content: 'a{}' },
      { name: 'foo', content: 'b{}' },
      { name: 'foo', content: 'c{}' },
    ])
    const result = await importThemesFromZip(buf)
    expect(result.imported).toBe(3)

    const names = (await listThemes())
      .filter((t) => !t.builtinKey)
      .map((t) => t.name)
      .sort()
    expect(names).toEqual(['foo', 'foo (1)', 'foo (2)'])
  })

  it('导入的主题 builtinKey 为 null', async () => {
    const buf = buildZip([{ name: 'imported', content: 'x' }])
    await importThemesFromZip(buf)
    const row = (await listThemes()).find((t) => t.name === 'imported')
    expect(row?.builtinKey).toBeNull()
  })

  it('skipped 计数来自 zip 工具层的过滤', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const buf = zipSync({
      'ok.css': strToU8('a{}'),
      'sub/skip.css': strToU8('b{}'),
      'readme.txt': strToU8('c'),
    })
    const result = await importThemesFromZip(buf)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(2)
  })

  it('空 zip 返回 imported=0', async () => {
    const buf = buildZip([])
    const result = await importThemesFromZip(buf)
    expect(result.imported).toBe(0)
  })

  it('export → import round-trip 后记录翻倍（追加语义）', async () => {
    const a = await createTheme({ name: 'A', css: 'a{}' })
    const b = await createTheme({ name: 'B', css: 'b{}' })
    const buf = await exportThemesAsZip([a!.id, b!.id])
    const result = await importThemesFromZip(buf)
    expect(result.imported).toBe(2)

    const custom = (await listThemes()).filter((t) => !t.builtinKey)
    expect(custom.map((t) => t.name).sort()).toEqual(['A', 'A', 'B', 'B'])
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
