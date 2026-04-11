import * as schema from '@/server/db/schema'
import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  createCustomStyle,
  deleteCustomStyle,
  exportCustomStylesAsZip,
  getCustomStyleById,
  importCustomStylesFromZip,
  listCustomStyles,
  listCustomStylesByIds,
  reorderCustomStyles,
  updateCustomStyle,
} = await import('./custom-styles')
const { buildZip, parseZip } = await import('@/server/lib/zip')

beforeEach(async () => {
  await setupTestDb()
})

describe('createCustomStyle', () => {
  it('缺省 sortOrder 时自动递增', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'a{}' })
    const b = await createCustomStyle({ name: 'B', css: 'b{}' })
    const c = await createCustomStyle({ name: 'C' })
    expect(a!.sortOrder).toBe(1)
    expect(b!.sortOrder).toBe(2)
    expect(c!.sortOrder).toBe(3)
    expect(c!.css).toBe('')
  })

  it('显式传入 sortOrder 时保留', async () => {
    const row = await createCustomStyle({ name: 'X', css: '', sortOrder: 42 })
    expect(row!.sortOrder).toBe(42)
  })
})

describe('listCustomStyles', () => {
  it('按 sortOrder 升序返回', async () => {
    await createCustomStyle({ name: 'A', css: '' })
    await createCustomStyle({ name: 'B', css: '' })
    await createCustomStyle({ name: 'C', css: '' })

    const rows = await listCustomStyles()
    expect(rows.map((r) => r.name)).toEqual(['A', 'B', 'C'])
  })
})

describe('getCustomStyleById', () => {
  it('返回对应记录或 undefined', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'body{}' })
    const found = await getCustomStyleById(a!.id)
    expect(found?.name).toBe('A')

    const missing = await getCustomStyleById(99999)
    expect(missing).toBeNull()
  })
})

describe('updateCustomStyle', () => {
  it('更新 name / css / sortOrder', async () => {
    const a = await createCustomStyle({ name: '原', css: 'a{}' })
    const updated = await updateCustomStyle(a!.id, {
      name: '新',
      css: 'b{}',
      sortOrder: 10,
    })
    expect(updated!.name).toBe('新')
    expect(updated!.css).toBe('b{}')
    expect(updated!.sortOrder).toBe(10)
  })

  it('目标 id 不存在时返回 null', async () => {
    const result = await updateCustomStyle(99999, { name: 'X' })
    expect(result).toBeNull()
  })
})

describe('deleteCustomStyle', () => {
  it('删除存在的记录', async () => {
    const a = await createCustomStyle({ name: 'A', css: '' })
    const result = await deleteCustomStyle(a!.id)
    expect(result.success).toBe(true)
    expect(await getCustomStyleById(a!.id)).toBeNull()
  })

  it('id 不存在时返回 success:false', async () => {
    const result = await deleteCustomStyle(99999)
    expect(result.success).toBe(false)
  })
})

describe('reorderCustomStyles', () => {
  it('按传入顺序重写 sortOrder', async () => {
    const a = await createCustomStyle({ name: 'A', css: '' })
    const b = await createCustomStyle({ name: 'B', css: '' })
    const c = await createCustomStyle({ name: 'C', css: '' })

    await reorderCustomStyles([c!.id, a!.id, b!.id])

    const rows = await testDb
      .select()
      .from(schema.customStyles)
      .orderBy(asc(schema.customStyles.sortOrder))
    expect(rows.map((r) => r.id)).toEqual([c!.id, a!.id, b!.id])
    expect(rows.map((r) => r.sortOrder)).toEqual([1, 2, 3])
  })

  it('id 列表与数据库不一致时抛错', async () => {
    const a = await createCustomStyle({ name: 'A', css: '' })
    const b = await createCustomStyle({ name: 'B', css: '' })

    // 缺项
    await expect(reorderCustomStyles([a!.id])).rejects.toThrow()
    // 重复项
    await expect(reorderCustomStyles([a!.id, a!.id])).rejects.toThrow()
    // 未知 id
    await expect(reorderCustomStyles([a!.id, b!.id, 99999])).rejects.toThrow()
  })
})

describe('exportCustomStylesAsZip', () => {
  it('按 ids 传入顺序导出', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'a{}' })
    const b = await createCustomStyle({ name: 'B', css: 'b{}' })
    const c = await createCustomStyle({ name: 'C', css: 'c{}' })
    const buf = await exportCustomStylesAsZip([c!.id, a!.id, b!.id])
    const raw = (await import('fflate')).unzipSync(buf)
    expect(Object.keys(raw)).toEqual(['C.css', 'A.css', 'B.css'])
  })

  it('未匹配到的 id 静默忽略', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'a{}' })
    const buf = await exportCustomStylesAsZip([a!.id, 99999])
    const { entries } = parseZip(buf)
    expect(entries.map((e) => e.name)).toEqual(['A'])
  })

  it('全部 id 不存在时返回空 Uint8Array', async () => {
    const buf = await exportCustomStylesAsZip([99999])
    expect(buf.byteLength).toBe(0)
  })

  it('content 字段保留原 css 原文', async () => {
    const css = '.btn { padding: 8px 16px; }\n.btn:hover { opacity: 0.8; }'
    const a = await createCustomStyle({ name: '按钮', css })
    const buf = await exportCustomStylesAsZip([a!.id])
    const { entries } = parseZip(buf)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('按钮')
    expect(entries[0].content).toBe(css)
  })
})

describe('importCustomStylesFromZip', () => {
  it('导入与已有记录同名时直接新增（追加，不覆盖）', async () => {
    const existing = await createCustomStyle({ name: 'foo', css: 'old{}' })
    const buf = buildZip([{ name: 'foo', content: 'new{}' }])
    const result = await importCustomStylesFromZip(buf)
    expect(result.imported).toBe(1)

    const rows = (await listCustomStyles()).filter((t) => t.name === 'foo')
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === existing!.id)?.css).toBe('old{}')
    expect(rows.find((r) => r.id !== existing!.id)?.css).toBe('new{}')
  })

  it('zip 内重名条目被 zip 层去重后都能导入', async () => {
    const buf = buildZip([
      { name: 'foo', content: 'a{}' },
      { name: 'foo', content: 'b{}' },
    ])
    const result = await importCustomStylesFromZip(buf)
    expect(result.imported).toBe(2)
    const names = (await listCustomStyles()).map((t) => t.name).sort()
    expect(names).toEqual(['foo', 'foo (1)'])
  })

  it('skipped 计数来自 zip 工具层的过滤', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const buf = zipSync({
      'ok.css': strToU8('a{}'),
      '__MACOSX/meta.css': strToU8('m'),
      '.DS_Store': strToU8('m'),
    })
    const result = await importCustomStylesFromZip(buf)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(2)
  })

  it('空 zip 返回 imported=0', async () => {
    const buf = buildZip([])
    const result = await importCustomStylesFromZip(buf)
    expect(result.imported).toBe(0)
  })

  it('export → import round-trip 后记录翻倍', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'a{}' })
    const b = await createCustomStyle({ name: 'B', css: 'b{}' })
    const buf = await exportCustomStylesAsZip([a!.id, b!.id])
    const result = await importCustomStylesFromZip(buf)
    expect(result.imported).toBe(2)

    const rows = await listCustomStyles()
    expect(rows.map((r) => r.name).sort()).toEqual(['A', 'A', 'B', 'B'])
  })
})

describe('listCustomStylesByIds', () => {
  it('按输入顺序返回对应记录', async () => {
    const a = await createCustomStyle({ name: 'A', css: 'a{}' })
    const b = await createCustomStyle({ name: 'B', css: 'b{}' })
    const c = await createCustomStyle({ name: 'C', css: 'c{}' })

    const rows = await listCustomStylesByIds([c!.id, a!.id, b!.id])
    expect(rows.map((r) => r.name)).toEqual(['C', 'A', 'B'])
  })

  it('过滤掉不存在的 id', async () => {
    const a = await createCustomStyle({ name: 'A', css: '' })
    const rows = await listCustomStylesByIds([a!.id, 99999])
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(a!.id)
  })

  it('空数组输入返回空数组', async () => {
    const rows = await listCustomStylesByIds([])
    expect(rows).toEqual([])
  })
})
