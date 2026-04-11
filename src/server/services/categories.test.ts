import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

const { createCategory, listCategories, reorderCategories } = await import('./categories')

beforeEach(async () => {
  await setupTestDb()
})

describe('categories service', () => {
  it('新建分类自动排在末尾', async () => {
    await createCategory({ name: 'A', slug: 'a' })
    await createCategory({ name: 'B', slug: 'b' })
    await createCategory({ name: 'C', slug: 'c' })

    const list = await listCategories()
    expect(list.map((c) => ({ name: c.name, sortOrder: c.sortOrder }))).toEqual([
      { name: 'A', sortOrder: 1 },
      { name: 'B', sortOrder: 2 },
      { name: 'C', sortOrder: 3 },
    ])
  })

  it('拖拽重排后顺序会持久化', async () => {
    const a = await createCategory({ name: 'A', slug: 'a' })
    const b = await createCategory({ name: 'B', slug: 'b' })
    const c = await createCategory({ name: 'C', slug: 'c' })

    await reorderCategories([c.id, a.id, b.id])

    const list = await listCategories()
    expect(list.map((item) => ({ id: item.id, sortOrder: item.sortOrder }))).toEqual([
      { id: c.id, sortOrder: 1 },
      { id: a.id, sortOrder: 2 },
      { id: b.id, sortOrder: 3 },
    ])
  })

  it('reorderCategories 传入非法 ids 会被拒绝', async () => {
    await createCategory({ name: 'A', slug: 'a' })

    // ids 数量不匹配
    await expect(reorderCategories([1, 2])).rejects.toThrow('Invalid category reorder ids')

    // 包含不存在的 id
    await expect(reorderCategories([999])).rejects.toThrow('Invalid category reorder ids')
  })

  it('重排后新建分类仍在末尾', async () => {
    const a = await createCategory({ name: 'A', slug: 'a' })
    const b = await createCategory({ name: 'B', slug: 'b' })

    await reorderCategories([b.id, a.id])
    await createCategory({ name: 'C', slug: 'c' })

    const list = await listCategories()
    expect(list.map((c) => c.name)).toEqual(['B', 'A', 'C'])
  })
})
