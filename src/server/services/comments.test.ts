import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { listComments } = await import('./comments')

beforeEach(async () => {
  await setupTestDb()
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
