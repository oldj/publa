import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { listComments, createComment } = await import('./comments')

beforeEach(async () => {
  await setupTestDb()
})

async function createPost(overrides: Partial<typeof schema.contents.$inferInsert> = {}) {
  const [post] = await testDb
    .insert(schema.contents)
    .values({
      type: 'post',
      title: '测试文章',
      slug: 'test-post',
      authorId: 1,
      contentRaw: '# 标题',
      contentHtml: '<h1>标题</h1>',
      contentText: '标题',
      status: 'published',
      allowComment: true,
      showComments: true,
      publishedAt: new Date().toISOString(),
      ...overrides,
    })
    .returning()
  return post
}

function setSetting(key: string, value: string) {
  return testDb.insert(schema.settings).values({ key, value })
}

describe('createComment 服务端校验', () => {
  const commentInput = {
    contentId: 1,
    authorName: '访客',
    content: '测试评论',
  }

  it('全局 enableComment 关闭时拒绝提交', async () => {
    await createPost()
    await setSetting('enableComment', 'false')

    const result = await createComment(commentInput)
    expect(result.success).toBe(false)
  })

  it('全局 showCommentsGlobally 关闭时拒绝提交', async () => {
    await createPost()
    await setSetting('showCommentsGlobally', 'false')

    const result = await createComment(commentInput)
    expect(result.success).toBe(false)
  })

  it('文章 allowComment 关闭时拒绝提交', async () => {
    await createPost({ allowComment: false })

    const result = await createComment(commentInput)
    expect(result.success).toBe(false)
  })

  it('文章 showComments 关闭时拒绝提交', async () => {
    await createPost({ showComments: false })

    const result = await createComment(commentInput)
    expect(result.success).toBe(false)
  })

  it('页面类型禁止评论', async () => {
    await createPost({ type: 'page' })

    const result = await createComment(commentInput)
    expect(result.success).toBe(false)
  })

  it('所有开关开启时允许提交', async () => {
    await createPost()

    const result = await createComment(commentInput)
    expect(result.success).toBe(true)
  })
})

describe('listComments', () => {
  it('批量聚合评论作者统计', async () => {
    const [post] = await testDb
      .insert(schema.contents)
      .values({
        type: 'post',
        title: '测试文章',
        slug: 'test-post',
        authorId: 1,
        contentRaw: '# 标题',
        contentHtml: '<h1>标题</h1>',
        contentText: '标题',
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
      .returning()

    await testDb.insert(schema.comments).values([
      {
        contentId: post.id,
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        content: 'pending',
        status: 'pending',
        createdAt: '2026-03-31T10:00:00.000Z',
      },
      {
        contentId: post.id,
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        content: 'approved',
        status: 'approved',
        createdAt: '2026-03-31T09:00:00.000Z',
      },
      {
        contentId: post.id,
        authorName: 'Alice',
        authorEmail: 'alice@example.com',
        content: 'rejected',
        status: 'rejected',
        createdAt: '2026-03-31T08:00:00.000Z',
      },
      {
        contentId: post.id,
        authorName: 'Bob',
        authorEmail: 'bob@example.com',
        content: 'other',
        status: 'approved',
        createdAt: '2026-03-31T07:00:00.000Z',
      },
    ])

    const result = await listComments()
    const aliceComment = result.items.find((item) => item.authorEmail === 'alice@example.com')

    expect(aliceComment?.authorStats).toEqual({
      approved: 1,
      rejected: 1,
      total: 3,
    })
  })
})
