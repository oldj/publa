import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { contents } from '@/server/db/schema'
import { createEmailLog } from '@/server/services/email-logs'
import { sendEmail } from '@/server/services/email-sender'
import { getSetting } from '@/server/services/settings'
import { listUsers } from '@/server/services/users'
import { eq } from 'drizzle-orm'

interface NotifyConfig {
  enabled: boolean
  userIds: number[]
}

function parseNotifyConfig(value: unknown): NotifyConfig | null {
  if (!value) return null
  // 兼容旧格式（字符串）和新格式（对象）
  let parsed = value
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  if (parsed && typeof parsed === 'object' && 'enabled' in parsed) {
    const obj = parsed as Record<string, unknown>
    if (obj.enabled && Array.isArray(obj.userIds) && obj.userIds.length > 0) {
      return parsed as NotifyConfig
    }
  }
  return null
}

/** 根据配置获取要通知的邮箱列表 */
async function resolveRecipients(config: NotifyConfig): Promise<string[]> {
  const allUsers = await listUsers()
  const targetIds = new Set(config.userIds)
  return allUsers.filter((u) => targetIds.has(u.id) && u.email).map((u) => u.email!)
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function buildEmailHtml(options: {
  title: string
  body: string
  linkUrl: string
  linkText: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">${options.title}</h2>
  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    ${options.body}
  </div>
  <a href="${escapeHtml(options.linkUrl)}" style="display: inline-block; background: #228be6; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px;">${options.linkText}</a>
</body>
</html>`
}

/** 新评论通知 */
export async function notifyNewComment(data: {
  authorName: string
  content: string
  contentId: number
}) {
  const config = parseNotifyConfig(await getSetting('emailNotifyNewComment'))
  if (!config) return

  const recipients = await resolveRecipients(config)
  if (recipients.length === 0) return

  const row = await maybeFirst(
    db.select({ title: contents.title }).from(contents).where(eq(contents.id, data.contentId)),
  )
  const contentTitle = row?.title || '未知文章'

  const siteUrl = String((await getSetting('siteUrl')) ?? '')
  const subject = `新评论：${truncate(contentTitle, 50)}`
  const html = buildEmailHtml({
    title: `文章「${escapeHtml(contentTitle)}」收到新评论`,
    body: `<p style="margin: 0 0 8px;"><strong>${escapeHtml(data.authorName)}</strong> 说：</p>
<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(truncate(data.content, 500))}</p>`,
    linkUrl: `${siteUrl}/admin/comments`,
    linkText: '查看评论',
  })

  const result = await sendEmail(recipients, subject, html)
  await createEmailLog({
    eventType: 'new_comment',
    recipients,
    subject,
    status: result.success ? 'success' : 'fail',
    errorMessage: result.error,
  })
}

/** 新留言通知 */
export async function notifyNewGuestbook(data: { authorName: string; content: string }) {
  const config = parseNotifyConfig(await getSetting('emailNotifyNewGuestbook'))
  if (!config) return

  const recipients = await resolveRecipients(config)
  if (recipients.length === 0) return

  const siteUrl = String((await getSetting('siteUrl')) ?? '')
  const subject = `新留言：来自 ${data.authorName}`
  const html = buildEmailHtml({
    title: '收到新的留言',
    body: `<p style="margin: 0 0 8px;"><strong>${escapeHtml(data.authorName)}</strong> 说：</p>
<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(truncate(data.content, 500))}</p>`,
    linkUrl: `${siteUrl}/admin/guestbook`,
    linkText: '查看留言',
  })

  const result = await sendEmail(recipients, subject, html)
  await createEmailLog({
    eventType: 'new_guestbook',
    recipients,
    subject,
    status: result.success ? 'success' : 'fail',
    errorMessage: result.error,
  })
}
