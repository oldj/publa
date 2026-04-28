import { db } from '@/server/db'
import { activityLogs, users } from '@/server/db/schema'
import { activityAction } from '@/server/db/schema/shared'
import { getRequestInfo } from '@/server/lib/request-info'
import { count, desc, eq, lt, max } from 'drizzle-orm'

type ActivityAction = (typeof activityAction)[number]

/** 记录一条活动日志 */
export async function createActivityLog(data: {
  userId: number
  action: ActivityAction
  ipAddress?: string
  userAgent?: string
}) {
  await db.insert(activityLogs).values({
    userId: data.userId,
    action: data.action,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
  })
}

/** 从请求中提取客户端信息并记录活动日志，失败时仅打印错误不中断主流程 */
export async function logActivity(request: Request, userId: number, action: ActivityAction) {
  try {
    const { ip, ua } = getRequestInfo(request)
    await createActivityLog({ userId, action, ipAddress: ip, userAgent: ua })
  } catch (err) {
    console.error('[logActivity] Failed to log activity:', err)
  }
}

/** 分页查询某用户的活动日志 */
export async function listUserActivityLogs({
  userId,
  page = 1,
  pageSize = 30,
}: {
  userId: number
  page?: number
  pageSize?: number
}) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))

  const items = await db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { total, page, pageSize, items }
}

/** 分页查询全站活动日志，附带用户名 */
export async function listActivityLogs({
  page = 1,
  pageSize = 20,
}: {
  page?: number
  pageSize?: number
} = {}) {
  const [{ total }] = await db.select({ total: count() }).from(activityLogs)

  const items = await db
    .select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      username: users.username,
      role: users.role,
      action: activityLogs.action,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { total, page, pageSize, items }
}

/** 获取每个用户的最后活跃时间映射 */
export async function getLastActiveMap(): Promise<Map<number, string>> {
  const rows = await db
    .select({
      userId: activityLogs.userId,
      lastActive: max(activityLogs.createdAt),
    })
    .from(activityLogs)
    .groupBy(activityLogs.userId)

  const map = new Map<number, string>()
  for (const row of rows) {
    if (row.lastActive) map.set(row.userId, row.lastActive)
  }
  return map
}

/** 清理 30 天前的活动日志 */
export async function cleanOldActivityLogs() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  await db.delete(activityLogs).where(lt(activityLogs.createdAt, cutoff))
}
