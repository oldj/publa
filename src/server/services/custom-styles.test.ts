import * as schema from '@/server/db/schema'
import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  createCustomStyle,
  deleteCustomStyle,
  getCustomStyleById,
  listCustomStyles,
  listCustomStylesByIds,
  reorderCustomStyles,
  updateCustomStyle,
} = await import('./custom-styles')

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
