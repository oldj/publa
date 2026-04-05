import { db } from '@/server/db'
import { rateEvents } from '@/server/db/schema'
import { and, count, eq, gte, lt } from 'drizzle-orm'

type RateEventType = 'login_fail' | 'comment' | 'guestbook'

/** 记录一条速率事件 */
export async function recordRateEvent(
  eventType: RateEventType,
  identifier: string,
  ipAddress?: string,
) {
  await db.insert(rateEvents).values({ eventType, identifier, ipAddress })
}

/** 检查登录是否被锁定（5 分钟内失败 >= 5 次） */
export async function isLoginLocked(username: string): Promise<boolean> {
  const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const [row] = await db
    .select({ total: count() })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.eventType, 'login_fail'),
        eq(rateEvents.identifier, username),
        gte(rateEvents.createdAt, threshold),
      ),
    )
  return (row?.total ?? 0) >= 5
}

/**
 * 原子地检查并占位：在事务内查询 30 秒内是否有同类事件，
 * 若无则立即写入一条记录。返回 true 表示获取到提交槽位。
 * 利用 SQLite/PG 事务写锁防止并发穿透。
 */
export async function acquireSubmissionSlot(
  eventType: 'comment' | 'guestbook',
  sessionId: string,
  ipAddress?: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const threshold = new Date(Date.now() - 30 * 1000).toISOString()
    const [row] = await tx
      .select({ total: count() })
      .from(rateEvents)
      .where(
        and(
          eq(rateEvents.eventType, eventType),
          eq(rateEvents.identifier, sessionId),
          gte(rateEvents.createdAt, threshold),
        ),
      )
    if ((row?.total ?? 0) >= 1) return false
    await tx.insert(rateEvents).values({ eventType, identifier: sessionId, ipAddress })
    return true
  })
}

/** 清理 24 小时前的过期记录 */
export async function cleanExpiredRateEvents() {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await db.delete(rateEvents).where(lt(rateEvents.createdAt, threshold))
}
