import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'

// setup.ts 中已执行 vi.mock('@/server/db')
const {
  saveDraft,
  getDraft,
  publishDraft,
  listPublishedRevisions,
  getRevisionById,
  deleteRevisions,
  restoreRevision,
  deleteDraft,
  deleteRevisionsByTarget,
} = await import('./revisions')

beforeEach(async () => {
  await setupTestDb()
})

describe('saveDraft', () => {
  it('创建新草稿', async () => {
    const result = await saveDraft(
      'post',
      1,
      {
        title: '', excerpt: '',
        contentRaw: '# Hello',
        contentHtml: '<h1>Hello</h1>',
        contentText: 'Hello',
      },
      1,
    )

    expect(result.updatedAt).toBeDefined()

    const draft = await getDraft('post', 1)
    expect(draft).not.toBeNull()
    expect(draft!.contentRaw).toBe('# Hello')
    expect(draft!.status).toBe('draft')
    expect(draft!.createdBy).toBe(1)
  })

  it('更新已有草稿（upsert）', async () => {
    await saveDraft(
      'post',
      1,
      {
        title: '', excerpt: '',
        contentRaw: 'v1',
        contentHtml: '<p>v1</p>',
        contentText: 'v1',
      },
      1,
    )

    await saveDraft(
      'post',
      1,
      {
        title: '', excerpt: '',
        contentRaw: 'v2',
        contentHtml: '<p>v2</p>',
        contentText: 'v2',
      },
      2,
    )

    const draft = await getDraft('post', 1)
    expect(draft!.contentRaw).toBe('v2')
    // 更新时 createdBy 应同步为最新操作者
    expect(draft!.createdBy).toBe(2)
  })

  it('不同 target 的草稿互不干扰', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'post-1', contentHtml: '', contentText: '' }, 1)
    await saveDraft('page', 1, { title: '', excerpt: '', contentRaw: 'page-1', contentHtml: '', contentText: '' }, 1)
    await saveDraft('post', 2, { title: '', excerpt: '', contentRaw: 'post-2', contentHtml: '', contentText: '' }, 1)

    expect((await getDraft('post', 1))!.contentRaw).toBe('post-1')
    expect((await getDraft('page', 1))!.contentRaw).toBe('page-1')
    expect((await getDraft('post', 2))!.contentRaw).toBe('post-2')
  })
})

describe('getDraft', () => {
  it('无草稿时返回 null', async () => {
    const draft = await getDraft('post', 999)
    expect(draft).toBeNull()
  })
})

describe('publishDraft', () => {
  it('将草稿冻结为历史版本', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft content', contentHtml: '<p>draft</p>', contentText: 'draft' },
      1,
    )

    const published = await publishDraft('post', 1)
    expect(published).not.toBeNull()
    expect(published!.status).toBe('published')

    // 草稿应该不再存在
    const draft = await getDraft('post', 1)
    expect(draft).toBeNull()
  })

  it('无草稿时返回 null', async () => {
    const result = await publishDraft('post', 999)
    expect(result).toBeNull()
  })

  it('多次发布创建多个历史版本', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)
  })
})

describe('listPublishedRevisions', () => {
  it('按时间倒序列出历史版本', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)
    expect(revisions[0].updatedAt >= revisions[1].updatedAt).toBe(true)
  })

  it('不包含草稿', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' }, 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(0)
  })

  it('不同 target 的版本互不干扰', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    await saveDraft('page', 1, { title: '', excerpt: '', contentRaw: 'p', contentHtml: '', contentText: '' }, 1)
    await publishDraft('page', 1)

    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)
    expect(await listPublishedRevisions('page', 1)).toHaveLength(1)
  })
})

describe('getRevisionById', () => {
  it('获取单条修订含内容', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'test content', contentHtml: '<p>test</p>', contentText: 'test' },
      1,
    )
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    const revision = await getRevisionById(revisions[0].id)
    expect(revision).not.toBeNull()
    expect(revision!.contentRaw).toBe('test content')
    expect(revision!.contentHtml).toBe('<p>test</p>')
  })

  it('不存在的 ID 返回 null', async () => {
    const result = await getRevisionById(99999)
    expect(result).toBeNull()
  })
})

describe('deleteRevisions', () => {
  it('批量删除已发布版本', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)

    await deleteRevisions('post', 1, [revisions[0].id])
    const remaining = await listPublishedRevisions('post', 1)
    expect(remaining).toHaveLength(1)
  })

  it('不能删除草稿', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' }, 1)
    const draft = await getDraft('post', 1)

    await deleteRevisions('post', 1, [draft!.id])
    const stillExists = await getDraft('post', 1)
    expect(stillExists).not.toBeNull()
  })

  it('不能跨 target 删除', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    await deleteRevisions('page', 1, [revisions[0].id])
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)
  })

  it('空数组不报错', async () => {
    const result = await deleteRevisions('post', 1, [])
    expect(result).toBe(0)
  })
})

describe('restoreRevision', () => {
  it('恢复版本创建新的历史记录', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '<p>v1</p>', contentText: 'v1' },
      1,
    )
    await publishDraft('post', 1)
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '<p>v2</p>', contentText: 'v2' },
      1,
    )
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    const oldVersion = revisions.reduce((a, b) => (a.id < b.id ? a : b))

    const result = await restoreRevision('post', 1, oldVersion.id, 1)
    expect(result).not.toBeNull()
    expect(result!.content.contentRaw).toBe('v1')

    const newRevisions = await listPublishedRevisions('post', 1)
    expect(newRevisions).toHaveLength(3)

    expect(await getDraft('post', 1)).toBeNull()
  })

  it('不能恢复不属于当前 target 的版本', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    const revisions = await listPublishedRevisions('post', 1)
    const result = await restoreRevision('page', 1, revisions[0].id, 1)
    expect(result).toBeNull()
  })

  it('不存在的版本返回 null', async () => {
    const result = await restoreRevision('post', 1, 99999, 1)
    expect(result).toBeNull()
  })
})

describe('deleteRevisionsByTarget', () => {
  it('删除某 target 的所有修订（含草稿和历史版本）', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' }, 1)

    await saveDraft('post', 2, { title: '', excerpt: '', contentRaw: 'other', contentHtml: '', contentText: '' }, 1)

    await deleteRevisionsByTarget('post', 1)

    expect(await getDraft('post', 1)).toBeNull()
    expect(await listPublishedRevisions('post', 1)).toHaveLength(0)
    expect(await getDraft('post', 2)).not.toBeNull()
  })
})

describe('deleteDraft', () => {
  it('删除草稿后恢复为已发布内容', async () => {
    // 模拟：先保存草稿，然后删除草稿（撤销修改）
    await saveDraft('post', 1, { title: '新标题', excerpt: '', contentRaw: '未发布的修改', contentHtml: '<p>未发布的修改</p>', contentText: '未发布的修改' }, 1)

    // 草稿应存在
    const draft = await getDraft('post', 1)
    expect(draft).not.toBeNull()
    expect(draft!.contentRaw).toBe('未发布的修改')

    // 删除草稿
    await deleteDraft('post', 1)

    // 草稿应不再存在
    expect(await getDraft('post', 1)).toBeNull()
  })

  it('删除草稿不影响已发布的历史版本', async () => {
    // 创建一个历史版本
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' }, 1)
    await publishDraft('post', 1)

    // 再创建一个草稿
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' }, 1)

    // 删除草稿
    await deleteDraft('post', 1)

    // 草稿没了，但历史版本还在
    expect(await getDraft('post', 1)).toBeNull()
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)
  })

  it('删除不存在的草稿不报错', async () => {
    await deleteDraft('post', 999)
    expect(await getDraft('post', 999)).toBeNull()
  })

  it('不同 target 的草稿互不影响', async () => {
    await saveDraft('post', 1, { title: '', excerpt: '', contentRaw: 'post-draft', contentHtml: '', contentText: '' }, 1)
    await saveDraft('page', 1, { title: '', excerpt: '', contentRaw: 'page-draft', contentHtml: '', contentText: '' }, 1)

    await deleteDraft('post', 1)

    expect(await getDraft('post', 1)).toBeNull()
    expect(await getDraft('page', 1)).not.toBeNull()
  })
})
