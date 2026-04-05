import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { setupTestDb, testDb } from './__test__/setup'

// setup.ts 中已执行 vi.mock('@/server/db')
const { publishScheduledPosts, updatePost } = await import('./posts')
const { publishScheduledPages } = await import('./pages')

beforeEach(async () => {
  await setupTestDb()
})

describe('publishScheduledPosts', () => {
  it('将到期的定时发布文章转为已发布', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'post', title: '过期文章', slug: 'past', authorId: 1, status: 'scheduled', publishedAt: pastTime,
    })

    await publishScheduledPosts()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'past')).limit(1),
    )
    expect(post?.status).toBe('published')
  })

  it('不影响未到期的定时发布文章', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'post', title: '未来文章', slug: 'future', authorId: 1, status: 'scheduled', publishedAt: futureTime,
    })

    await publishScheduledPosts()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'future')).limit(1),
    )
    expect(post?.status).toBe('scheduled')
  })

  it('不影响草稿文章', async () => {
    await testDb.insert(schema.contents).values({
      type: 'post', title: '草稿', slug: 'draft-one', authorId: 1, status: 'draft',
    })

    await publishScheduledPosts()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'draft-one')).limit(1),
    )
    expect(post?.status).toBe('draft')
  })

  it('不影响已删除的定时发布文章', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'post', title: '已删除', slug: 'deleted', authorId: 1, status: 'scheduled', publishedAt: pastTime, deletedAt: pastTime,
    })

    await publishScheduledPosts()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'deleted')).limit(1),
    )
    expect(post?.status).toBe('scheduled')
  })

  it('同时处理多篇到期文章', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values([
      { type: 'post' as const, title: '文章1', slug: 'a1', authorId: 1, status: 'scheduled', publishedAt: pastTime },
      { type: 'post' as const, title: '文章2', slug: 'a2', authorId: 1, status: 'scheduled', publishedAt: pastTime },
    ])

    await publishScheduledPosts()

    const a1 = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'a1')).limit(1),
    )
    const a2 = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.slug, 'a2')).limit(1),
    )
    expect(a1?.status).toBe('published')
    expect(a2?.status).toBe('published')
  })
})

describe('发布时间', () => {
  it('手动发布草稿时，publishedAt 为空则自动设为当前时间', async () => {
    await testDb.insert(schema.contents).values({
      type: 'post', id: 100, title: '草稿', slug: 'draft-pub', authorId: 1, status: 'draft', publishedAt: null,
    })

    const before = Date.now()
    await updatePost(100, { status: 'published' })
    const after = Date.now()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 100)).limit(1),
    )
    expect(post?.status).toBe('published')
    expect(post?.publishedAt).not.toBeNull()
    const pubTime = new Date(post!.publishedAt!).getTime()
    expect(pubTime).toBeGreaterThanOrEqual(before)
    expect(pubTime).toBeLessThanOrEqual(after)
  })

  it('手动发布时，已有 publishedAt 则保留原值', async () => {
    const oldTime = '2025-01-01T00:00:00.000Z'
    await testDb.insert(schema.contents).values({
      type: 'post', id: 101, title: '旧文章', slug: 'old-pub', authorId: 1, status: 'draft', publishedAt: oldTime,
    })

    await updatePost(101, { status: 'published' })

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 101)).limit(1),
    )
    expect(post?.publishedAt).toBe(oldTime)
  })

  it('手动发布时传入 publishedAt 则使用传入值', async () => {
    const customTime = '2026-06-15T12:00:00.000Z'
    await testDb.insert(schema.contents).values({
      type: 'post', id: 102, title: '自定义时间', slug: 'custom-pub', authorId: 1, status: 'draft',
    })

    await updatePost(102, { status: 'published', publishedAt: customTime })

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 102)).limit(1),
    )
    expect(post?.publishedAt).toBe(customTime)
  })

  it('定时发布到期后，publishedAt 保持不变', async () => {
    const scheduledTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'post', id: 103, title: '定时文章', slug: 'sched-pub', authorId: 1, status: 'scheduled', publishedAt: scheduledTime,
    })

    await publishScheduledPosts()

    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 103)).limit(1),
    )
    expect(post?.status).toBe('published')
    expect(post?.publishedAt).toBe(scheduledTime)
  })
})

describe('publishScheduledPages', () => {
  it('将到期的定时发布页面转为已发布', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'page', title: '过期页面', path: 'old-page', status: 'scheduled', publishedAt: pastTime,
    })

    await publishScheduledPages()

    const page = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.path, 'old-page')).limit(1),
    )
    expect(page?.status).toBe('published')
  })

  it('不影响未到期的定时发布页面', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'page', title: '未来页面', path: 'future-page', status: 'scheduled', publishedAt: futureTime,
    })

    await publishScheduledPages()

    const page = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.path, 'future-page')).limit(1),
    )
    expect(page?.status).toBe('scheduled')
  })

  it('不影响已删除的定时发布页面', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString()
    await testDb.insert(schema.contents).values({
      type: 'page', title: '已删除', path: 'del-page', status: 'scheduled', publishedAt: pastTime, deletedAt: pastTime,
    })

    await publishScheduledPages()

    const page = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.path, 'del-page')).limit(1),
    )
    expect(page?.status).toBe('scheduled')
  })
})
