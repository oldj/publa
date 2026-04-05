import { db } from '@/server/db'
import { emailLogs } from '@/server/db/schema'
import { count, desc, eq, lt } from 'drizzle-orm'

export async function createEmailLog(data: {
  eventType: 'new_comment' | 'new_guestbook' | 'test'
  recipients: string[]
  subject: string
  status: 'success' | 'fail'
  errorMessage?: string
}) {
  await db.insert(emailLogs).values({
    eventType: data.eventType,
    recipients: JSON.stringify(data.recipients),
    subject: data.subject,
    status: data.status,
    errorMessage: data.errorMessage || null,
  })
}

export async function listEmailLogs({ page = 1, pageSize = 50 }) {
  const [{ total }] = await db.select({ total: count() }).from(emailLogs)

  const rows = await db
    .select()
    .from(emailLogs)
    .orderBy(desc(emailLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return {
    total,
    page,
    pageSize,
    items: rows.map((r) => ({
      ...r,
      recipients: (() => {
        try {
          return JSON.parse(r.recipients) as string[]
        } catch {
          return []
        }
      })(),
    })),
  }
}

export async function deleteEmailLog(id: number) {
  await db.delete(emailLogs).where(eq(emailLogs.id, id))
}

/** 清理 30 天前的邮件日志 */
export async function cleanOldEmailLogs() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  await db.delete(emailLogs).where(lt(emailLogs.createdAt, cutoff))
}
