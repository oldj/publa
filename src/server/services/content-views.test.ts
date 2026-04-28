import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { recordPostView, getPostDailyViews } = await import('./content-views')

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

describe('getPostDailyViews', () => {
  async function seed(postId: number, rows: Array<{ date: string; viewCount: number }>) {
    await createPost(postId)
    if (rows.length > 0) {
      await testDb.insert(schema.contentDailyViews).values(
        rows.map((r) => ({
          date: r.date,
          contentId: postId,
          viewCount: r.viewCount,
        })),
      )
    }
  }

  it('在闭区间内按日期升序返回原始行（不补 0）', async () => {
    await seed(401, [
      { date: '2026-04-25', viewCount: 1 },
      { date: '2026-04-27', viewCount: 5 },
      { date: '2026-04-28', viewCount: 2 },
    ])

    const rows = await getPostDailyViews(401, '2026-04-25', '2026-04-28')
    expect(rows).toEqual([
      { date: '2026-04-25', viewCount: 1 },
      { date: '2026-04-27', viewCount: 5 },
      { date: '2026-04-28', viewCount: 2 },
    ])
  })

  it('区间端点为闭区间，包含 from 与 to 当天', async () => {
    await seed(402, [
      { date: '2026-04-20', viewCount: 9 },
      { date: '2026-04-21', viewCount: 3 },
      { date: '2026-04-22', viewCount: 4 },
    ])

    const rows = await getPostDailyViews(402, '2026-04-21', '2026-04-22')
    expect(rows.map((r) => r.date)).toEqual(['2026-04-21', '2026-04-22'])
  })

  it('按 contentId 隔离，不会串读其它文章', async () => {
    await seed(501, [{ date: '2026-04-28', viewCount: 11 }])
    await seed(502, [{ date: '2026-04-28', viewCount: 22 }])

    const rows = await getPostDailyViews(501, '2026-04-01', '2026-04-30')
    expect(rows).toEqual([{ date: '2026-04-28', viewCount: 11 }])
  })

  it('区间内无数据返回空数组', async () => {
    await createPost(601)
    const rows = await getPostDailyViews(601, '2026-04-01', '2026-04-30')
    expect(rows).toEqual([])
  })
})
