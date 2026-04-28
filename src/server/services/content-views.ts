import { db } from '@/server/db'
import { contentDailyViews, contents } from '@/server/db/schema'
import { getSiteDateString } from '@/server/lib/site-date'
import { and, asc, between, eq, sql } from 'drizzle-orm'

/**
 * 记录一次 post 访问：累计 contents.viewCount，并 UPSERT 当日 (date, contentId) 行。
 * 仅适用于 type='post' 的内容；调用方需自行确保。
 * 函数命名仍带 Post 是为了强调「调用方契约」—— 表本身是 type-agnostic 的，但当前业务规则
 * 是只统计 post，新增其他类型时应另起入口而非偷偷放宽这里。
 */
export async function recordPostView(postId: number): Promise<void> {
  const date = await getSiteDateString()

  await db.transaction(async (tx) => {
    await tx
      .update(contents)
      .set({ viewCount: sql`${contents.viewCount} + 1` })
      .where(eq(contents.id, postId))

    await tx
      .insert(contentDailyViews)
      .values({ date, contentId: postId, viewCount: 1 })
      .onConflictDoUpdate({
        target: [contentDailyViews.date, contentDailyViews.contentId],
        set: { viewCount: sql`${contentDailyViews.viewCount} + 1` },
      })
  })
}

/**
 * 查询某篇内容在 [from, to] 闭区间（'YYYY-MM-DD'）内的每日访问量。
 * 返回 DB 原始行（缺失日不会补 0），按日期升序，由调用方决定是否零填充。
 */
export async function getPostDailyViews(
  postId: number,
  from: string,
  to: string,
): Promise<Array<{ date: string; viewCount: number }>> {
  const rows = await db
    .select({
      date: contentDailyViews.date,
      viewCount: contentDailyViews.viewCount,
    })
    .from(contentDailyViews)
    .where(
      and(
        eq(contentDailyViews.contentId, postId),
        between(contentDailyViews.date, from, to),
      ),
    )
    .orderBy(asc(contentDailyViews.date))

  return rows
}
