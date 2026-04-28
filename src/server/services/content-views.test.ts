import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { recordPostView } = await import('./content-views')

beforeEach(async () => {
  await setupTestDb()
})

async function createPost(id: number) {
  await testDb.insert(schema.contents).values({
    id,
    type: 'post',
    title: '测试文章',
    slug: `post-${id}`,
    authorId: 1,
    contentRaw: '',
    contentHtml: '',
    contentText: '',
    status: 'published',
    allowComment: true,
    showComments: true,
    viewCount: 0,
    pinned: false,
    publishedAt: new Date().toISOString(),
  })
}

describe('recordPostView', () => {
  it('首次访问插入新行；同日再次访问走 ON CONFLICT 累加', async () => {
    await createPost(101)

    await recordPostView(101)
    await recordPostView(101)
    await recordPostView(101)

    // contents.viewCount 累加 3
    const post = await maybeFirst(
      testDb.select().from(schema.contents).where(eq(schema.contents.id, 101)).limit(1),
    )
    expect(post?.viewCount).toBe(3)

    // content_daily_views 同日只有一行，view_count = 3
    const rows = await testDb
      .select()
      .from(schema.contentDailyViews)
      .where(eq(schema.contentDailyViews.contentId, 101))
    expect(rows.length).toBe(1)
    expect(rows[0].viewCount).toBe(3)
  })

  it('不同 contentId 各自独立累加', async () => {
    await createPost(201)
    await createPost(202)

    await recordPostView(201)
    await recordPostView(202)
    await recordPostView(202)

    const all = await testDb.select().from(schema.contentDailyViews)
    const map = new Map(all.map((r) => [r.contentId, r.viewCount]))
    expect(map.get(201)).toBe(1)
    expect(map.get(202)).toBe(2)
  })

  it('当日合计可由 SUM 聚合得到，不依赖哨兵行', async () => {
    await createPost(301)
    await createPost(302)

    await recordPostView(301)
    await recordPostView(302)
    await recordPostView(302)

    const today = (
      await maybeFirst(
        testDb
          .select()
          .from(schema.contentDailyViews)
          .where(eq(schema.contentDailyViews.contentId, 301)),
      )
    )?.date
    expect(today).toBeTruthy()

    // 不应有 contentId=0 的哨兵行
    const sentinel = await maybeFirst(
      testDb
        .select()
        .from(schema.contentDailyViews)
        .where(
          and(eq(schema.contentDailyViews.date, today!), eq(schema.contentDailyViews.contentId, 0)),
        ),
    )
    expect(sentinel).toBeNull()

    // SUM 聚合得到当日总数
    const rows = await testDb
      .select()
      .from(schema.contentDailyViews)
      .where(eq(schema.contentDailyViews.date, today!))
    const total = rows.reduce((s, r) => s + r.viewCount, 0)
    expect(total).toBe(3)
  })
})
