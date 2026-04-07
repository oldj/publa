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
  cleanOrphanRevisions,
} = await import('./revisions')
const { createEmptyPost } = await import('./posts')
const { createEmptyPage } = await import('./pages')

beforeEach(async () => {
  await setupTestDb()
})

describe('saveDraft', () => {
  it('创建新草稿', async () => {
    const result = await saveDraft(
      'post',
      1,
      {
        title: '',
        excerpt: '',
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

  it('应保存完整草稿 metadata', async () => {
    await saveDraft(
      'post',
      1,
      {
        title: '草稿标题',
        excerpt: '摘要',
        contentType: 'markdown',
        contentRaw: '# Hello',
        contentHtml: '<h1>Hello</h1>',
        contentText: 'Hello',
        metadata: {
          slug: 'duplicate-slug',
          categoryId: 3,
          tagNames: ['前端', '测试'],
          seoTitle: 'SEO 标题',
          seoDescription: 'SEO 描述',
        },
      },
      1,
    )

    const draft = await getDraft('post', 1)
    expect(draft).not.toBeNull()
    expect(draft!.metadata).toMatchObject({
      slug: 'duplicate-slug',
      categoryId: 3,
      tagNames: ['前端', '测试'],
      seoTitle: 'SEO 标题',
      seoDescription: 'SEO 描述',
    })
  })

  it('更新已有草稿（upsert），首次覆盖时自动创建快照', async () => {
    await saveDraft(
      'post',
      1,
      {
        title: '',
        excerpt: '',
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
        title: '',
        excerpt: '',
        contentRaw: 'v2',
        contentHtml: '<p>v2</p>',
        contentText: 'v2',
      },
      2,
    )

    // 当前草稿应为 v2
    const draft = await getDraft('post', 1)
    expect(draft!.contentRaw).toBe('v2')
    // 快照创建后草稿是新行，createdBy 为触发者
    expect(draft!.createdBy).toBe(2)
    expect(draft!.updatedBy).toBe(2)

    // v1 应被冻结为快照
    const versions = await listPublishedRevisions('post', 1)
    expect(versions).toHaveLength(1)
    expect(versions[0].status).toBe('snapshot')
  })

  it('不同 target 的草稿互不干扰', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'post-1', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'page',
      1,
      { title: '', excerpt: '', contentRaw: 'page-1', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'post',
      2,
      { title: '', excerpt: '', contentRaw: 'post-2', contentHtml: '', contentText: '' },
      1,
    )

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
      {
        title: '',
        excerpt: '',
        contentRaw: 'draft content',
        contentHtml: '<p>draft</p>',
        contentText: 'draft',
      },
      1,
    )

    const published = await publishDraft('post', 1, 1)
    expect(published).not.toBeNull()
    expect(published!.status).toBe('published')

    // 草稿应该不再存在
    const draft = await getDraft('post', 1)
    expect(draft).toBeNull()
  })

  it('发布时应写入 updatedBy', async () => {
    const authorId = 1
    const publisherId = 2
    await saveDraft(
      'post',
      1,
      {
        title: '',
        excerpt: '',
        contentRaw: 'content',
        contentHtml: '<p>content</p>',
        contentText: 'content',
      },
      authorId,
    )

    await publishDraft('post', 1, publisherId)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(1)
    const revision = await getRevisionById(revisions[0].id)
    expect(revision).not.toBeNull()
    expect(revision!.createdBy).toBe(authorId)
    expect(revision!.updatedBy).toBe(publisherId)
  })

  it('无草稿时返回 null', async () => {
    const result = await publishDraft('post', 999, 1)
    expect(result).toBeNull()
  })

  it('多次发布创建多个历史版本', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)
  })

  it('发布后应保留草稿 metadata 到历史版本', async () => {
    await saveDraft(
      'page',
      1,
      {
        title: '页面草稿',
        excerpt: '',
        contentRaw: '<p>draft</p>',
        contentHtml: '<p>draft</p>',
        contentText: 'draft',
        metadata: {
          path: 'invalid/path/',
          template: 'blank',
          seoTitle: '页面 SEO',
          seoDescription: '页面描述',
        },
      },
      1,
    )

    const published = await publishDraft('page', 1, 1)
    expect(published).not.toBeNull()
    expect(published!.metadata).toMatchObject({
      path: 'invalid/path/',
      template: 'blank',
      seoTitle: '页面 SEO',
      seoDescription: '页面描述',
    })
  })
})

describe('listPublishedRevisions', () => {
  it('按时间倒序列出历史版本', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)
    expect(revisions[0].updatedAt >= revisions[1].updatedAt).toBe(true)
  })

  it('不包含草稿', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' },
      1,
    )

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(0)
  })

  it('不同 target 的版本互不干扰', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    await saveDraft(
      'page',
      1,
      { title: '', excerpt: '', contentRaw: 'p', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('page', 1, 1)

    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)
    expect(await listPublishedRevisions('page', 1)).toHaveLength(1)
  })
})

describe('getRevisionById', () => {
  it('获取单条修订含内容', async () => {
    await saveDraft(
      'post',
      1,
      {
        title: '',
        excerpt: '',
        contentRaw: 'test content',
        contentHtml: '<p>test</p>',
        contentText: 'test',
      },
      1,
    )
    await publishDraft('post', 1, 1)

    const revisions = await listPublishedRevisions('post', 1)
    const revision = await getRevisionById(revisions[0].id)
    expect(revision).not.toBeNull()
    expect(revision!.contentRaw).toBe('test content')
    expect(revision!.contentHtml).toBe('<p>test</p>')
  })

  it('获取单条修订时应解析 metadata', async () => {
    await saveDraft(
      'page',
      1,
      {
        title: '页面标题',
        excerpt: '',
        contentRaw: '<p>test</p>',
        contentHtml: '<p>test</p>',
        contentText: 'test',
        metadata: {
          path: 'about',
          template: 'blank',
        },
      },
      1,
    )
    await publishDraft('page', 1, 1)

    const revisions = await listPublishedRevisions('page', 1)
    const revision = await getRevisionById(revisions[0].id)
    expect(revision).not.toBeNull()
    expect(revision!.metadata).toMatchObject({
      path: 'about',
      template: 'blank',
    })
  })

  it('不存在的 ID 返回 null', async () => {
    const result = await getRevisionById(99999)
    expect(result).toBeNull()
  })
})

describe('deleteRevisions', () => {
  it('批量删除已发布版本', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    const revisions = await listPublishedRevisions('post', 1)
    expect(revisions).toHaveLength(2)

    await deleteRevisions('post', 1, [revisions[0].id])
    const remaining = await listPublishedRevisions('post', 1)
    expect(remaining).toHaveLength(1)
  })

  it('不能删除草稿', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' },
      1,
    )
    const draft = await getDraft('post', 1)

    await deleteRevisions('post', 1, [draft!.id])
    const stillExists = await getDraft('post', 1)
    expect(stillExists).not.toBeNull()
  })

  it('不能跨 target 删除', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

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
    await publishDraft('post', 1, 1)
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '<p>v2</p>', contentText: 'v2' },
      1,
    )
    await publishDraft('post', 1, 1)

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
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'a', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    const revisions = await listPublishedRevisions('post', 1)
    const result = await restoreRevision('page', 1, revisions[0].id, 1)
    expect(result).toBeNull()
  })

  it('恢复版本时应带回 metadata', async () => {
    await saveDraft(
      'page',
      1,
      {
        title: '版本一',
        excerpt: '',
        contentRaw: '<p>v1</p>',
        contentHtml: '<p>v1</p>',
        contentText: 'v1',
        metadata: {
          path: 'about-v1',
          template: 'blank',
          seoTitle: 'SEO V1',
          seoDescription: 'Desc V1',
        },
      },
      1,
    )
    await publishDraft('page', 1, 1)

    const revisions = await listPublishedRevisions('page', 1)
    const result = await restoreRevision('page', 1, revisions[0].id, 1)
    expect(result).not.toBeNull()
    expect(result!.content.metadata).toMatchObject({
      path: 'about-v1',
      template: 'blank',
      seoTitle: 'SEO V1',
      seoDescription: 'Desc V1',
    })
  })

  it('不存在的版本返回 null', async () => {
    const result = await restoreRevision('post', 1, 99999, 1)
    expect(result).toBeNull()
  })
})

describe('deleteRevisionsByTarget', () => {
  it('删除某 target 的所有修订（含草稿和历史版本）', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' },
      1,
    )

    await saveDraft(
      'post',
      2,
      { title: '', excerpt: '', contentRaw: 'other', contentHtml: '', contentText: '' },
      1,
    )

    await deleteRevisionsByTarget('post', 1)

    expect(await getDraft('post', 1)).toBeNull()
    expect(await listPublishedRevisions('post', 1)).toHaveLength(0)
    expect(await getDraft('post', 2)).not.toBeNull()
  })
})

describe('deleteDraft', () => {
  it('删除草稿后恢复为已发布内容', async () => {
    // 模拟：先保存草稿，然后删除草稿（撤销修改）
    await saveDraft(
      'post',
      1,
      {
        title: '新标题',
        excerpt: '',
        contentRaw: '未发布的修改',
        contentHtml: '<p>未发布的修改</p>',
        contentText: '未发布的修改',
      },
      1,
    )

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
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', 1, 1)

    // 再创建一个草稿
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft', contentHtml: '', contentText: '' },
      1,
    )

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
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'post-draft', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'page',
      1,
      { title: '', excerpt: '', contentRaw: 'page-draft', contentHtml: '', contentText: '' },
      1,
    )

    await deleteDraft('post', 1)

    expect(await getDraft('post', 1)).toBeNull()
    expect(await getDraft('page', 1)).not.toBeNull()
  })
})

describe('cleanOrphanRevisions', () => {
  it('删除无对应 content 的孤儿 revision', async () => {
    // targetId=99999 在 contents 表中不存在
    await saveDraft(
      'post',
      99999,
      { title: '孤儿', excerpt: '', contentRaw: 'orphan', contentHtml: '', contentText: '' },
      1,
    )
    expect(await getDraft('post', 99999)).not.toBeNull()

    const deleted = await cleanOrphanRevisions()
    expect(deleted).toBe(1)
    expect(await getDraft('post', 99999)).toBeNull()
  })

  it('不删除有对应 content 的 revision', async () => {
    const post = await createEmptyPost(1)
    await saveDraft(
      'post',
      post.id,
      { title: '正常草稿', excerpt: '', contentRaw: 'ok', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', post.id, 1)
    // 再创建一个新草稿
    await saveDraft(
      'post',
      post.id,
      { title: '新草稿', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' },
      1,
    )

    const deleted = await cleanOrphanRevisions()
    expect(deleted).toBe(0)

    // 草稿和历史版本都应保留
    expect(await getDraft('post', post.id)).not.toBeNull()
    expect(await listPublishedRevisions('post', post.id)).toHaveLength(1)
  })

  it('不删除软删除 content 的 revision', async () => {
    const post = await createEmptyPost(1)
    await saveDraft(
      'post',
      post.id,
      { title: '', excerpt: '', contentRaw: 'content', contentHtml: '', contentText: '' },
      1,
    )
    await publishDraft('post', post.id, 1)

    // 软删除 content（deletePost 内部也会清 revision，这里手动模拟仅软删除的场景）
    const { db } = await import('@/server/db')
    const { contents } = await import('@/server/db/schema')
    const { eq } = await import('drizzle-orm')
    await db
      .update(contents)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(contents.id, post.id))

    const deleted = await cleanOrphanRevisions()
    expect(deleted).toBe(0)
    expect(await listPublishedRevisions('post', post.id)).toHaveLength(1)
  })

  it('混合场景：只删除孤儿，保留正常 revision', async () => {
    const post = await createEmptyPost(1)
    const page = await createEmptyPage()

    // 正常 revision
    await saveDraft(
      'post',
      post.id,
      { title: '', excerpt: '', contentRaw: 'post', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'page',
      page.id,
      { title: '', excerpt: '', contentRaw: 'page', contentHtml: '', contentText: '' },
      1,
    )

    // 孤儿 revision
    await saveDraft(
      'post',
      88888,
      { title: '', excerpt: '', contentRaw: 'orphan1', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'page',
      77777,
      { title: '', excerpt: '', contentRaw: 'orphan2', contentHtml: '', contentText: '' },
      1,
    )

    const deleted = await cleanOrphanRevisions()
    expect(deleted).toBe(2)

    // 正常 revision 不受影响
    expect(await getDraft('post', post.id)).not.toBeNull()
    expect(await getDraft('page', page.id)).not.toBeNull()
    // 孤儿已清除
    expect(await getDraft('post', 88888)).toBeNull()
    expect(await getDraft('page', 77777)).toBeNull()
  })
})

describe('snapshot versioning', () => {
  it('首次 insert 不产生快照，第二次 upsert 产生快照', async () => {
    // 第一次：插入新草稿，无已有草稿，不会产生快照
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'first', contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(0)

    // 第二次：已有草稿且无历史版本 → 条件1触发快照
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'second', contentHtml: '', contentText: '' },
      1,
    )
    const versions = await listPublishedRevisions('post', 1)
    expect(versions).toHaveLength(1)
    expect(versions[0].status).toBe('snapshot')

    // 当前草稿应为最新内容
    const draft = await getDraft('post', 1)
    expect(draft!.contentRaw).toBe('second')
  })

  it('连续快速保存不重复产生快照（时间 < 10min 且长度差 < 500）', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'initial', contentHtml: '', contentText: '' },
      1,
    )
    // 第二次触发快照（条件1：无历史版本）
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'second', contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)

    // 第三次：已有快照且时间 < 10min 且长度差 < 500 → 不产生新快照
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'third', contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)

    // 第四次：同样不产生
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'fourth', contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)

    // 当前草稿应为最新
    const draft = await getDraft('post', 1)
    expect(draft!.contentRaw).toBe('fourth')
  })

  it('内容长度差 > 500 触发新快照', async () => {
    const shortContent = 'short'
    const longContent = 'x'.repeat(600)

    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: shortContent, contentHtml: '', contentText: '' },
      1,
    )
    // 第二次触发快照（条件1）
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: shortContent + '!', contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(1)

    // 第三次：内容长度差 > 500 → 条件3触发新快照
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: longContent, contentHtml: '', contentText: '' },
      1,
    )
    expect(await listPublishedRevisions('post', 1)).toHaveLength(2)

    const draft = await getDraft('post', 1)
    expect(draft!.contentRaw).toBe(longContent)
  })

  it('快照可通过 deleteRevisions 删除', async () => {
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v1', contentHtml: '', contentText: '' },
      1,
    )
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'v2', contentHtml: '', contentText: '' },
      1,
    )

    const versions = await listPublishedRevisions('post', 1)
    expect(versions).toHaveLength(1)

    await deleteRevisions('post', 1, [versions[0].id])
    expect(await listPublishedRevisions('post', 1)).toHaveLength(0)

    // 当前草稿不受影响
    expect(await getDraft('post', 1)).not.toBeNull()
  })

  it('快照可通过 restoreRevision 恢复', async () => {
    await saveDraft(
      'post',
      1,
      {
        title: '原始标题',
        excerpt: '',
        contentRaw: 'original content',
        contentHtml: '<p>original</p>',
        contentText: 'original',
      },
      1,
    )
    // 触发快照
    await saveDraft(
      'post',
      1,
      {
        title: '新标题',
        excerpt: '',
        contentRaw: 'new content',
        contentHtml: '<p>new</p>',
        contentText: 'new',
      },
      1,
    )

    const versions = await listPublishedRevisions('post', 1)
    expect(versions).toHaveLength(1)

    const result = await restoreRevision('post', 1, versions[0].id, 1)
    expect(result).not.toBeNull()
    expect(result!.content.contentRaw).toBe('original content')
    expect(result!.content.title).toBe('原始标题')
  })

  it('快照和发布版本共存于版本列表', async () => {
    // 创建草稿 → 快照 → 发布流程
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft-v1', contentHtml: '', contentText: '' },
      1,
    )
    // 第二次保存触发快照
    await saveDraft(
      'post',
      1,
      { title: '', excerpt: '', contentRaw: 'draft-v2', contentHtml: '', contentText: '' },
      1,
    )
    // 发布
    await publishDraft('post', 1, 1)

    const versions = await listPublishedRevisions('post', 1)
    expect(versions).toHaveLength(2)
    const statuses = versions.map((v) => v.status)
    expect(statuses).toContain('snapshot')
    expect(statuses).toContain('published')
  })
})
