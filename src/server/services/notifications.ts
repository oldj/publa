import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locales'
import { getServerTranslator } from '@/i18n/server'
import { adminUrl } from '@/lib/admin-path'
import { isValidEmail } from '@/lib/user-input'
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
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  if (obj.enabled && Array.isArray(obj.userIds) && obj.userIds.length > 0) {
    return value as NotifyConfig
  }
  return null
}

/** 根据配置获取要通知的邮箱列表（防御性过滤：跳过格式不合法的邮箱） */
async function resolveRecipients(config: NotifyConfig): Promise<string[]> {
  const allUsers = await listUsers()
  const targetIds = new Set(config.userIds)
  return allUsers
    .filter((u) => targetIds.has(u.id) && u.email && isValidEmail(u.email))
    .map((u) => u.email!)
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 把纯文本转 HTML：统一换行符 (\r\n / \r / \n → \n)，escape HTML 字符，再把 \n 转 <br>
// 不依赖 white-space: pre-wrap（Gmail 等客户端会剥离该样式）
function escapeHtmlWithBreaks(text: string): string {
  return escapeHtml(text.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>')
}

/**
 * 按 Unicode code point 截断，避免 JS 默认 slice 把 surrogate pair（如 emoji）切到一半。
 * 注：仍可能在 ZWJ 表情序列中间切断（如 👨‍👩‍👧），但已覆盖绝大多数实际场景。
 */
function truncate(text: string, max: number) {
  const chars = [...text]
  return chars.length > max ? chars.slice(0, max).join('') + '…' : text
}

/** 把多行字符串压成单行，用于邮件 subject（RFC 5322 不允许 raw LF） */
function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ')
}

/**
 * 读取并规范化 siteUrl：用 URL 解析，要求 protocol 是 http(s)、hostname 非空。
 * 返回空字符串表示「未设置或非法」，调用方应据此走降级（不渲染外链）。
 * 注：不接受 request 推断的 origin 作为 fallback，因为 x-forwarded-host 可伪造。
 */
async function getSafeSiteUrl(): Promise<string> {
  const raw = String((await getSetting('siteUrl')) ?? '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    if (!url.hostname) return ''
    // 保留 path（admin 可能配 https://example.com/blog 这种带子路径的站点），去尾斜杠
    return (url.origin + url.pathname).replace(/\/+$/, '')
  } catch {
    return ''
  }
}

// 邮件 HTML 模板：用 <table> 布局，避免 Gmail / Outlook 等客户端剥离 <div> 上的
// border / border-radius / margin / display:inline-block 等样式。
function buildEmailHtml(options: {
  title: string
  /** 内容框内的正文 HTML */
  body: string
  /** 内容框外、标题与内容框之间的引言段（如"XXX 说："） */
  bodyHeaderHtml?: string
  /** 主按钮链接；缺省时不渲染按钮，改用 actionsFallbackHtml */
  linkUrl?: string
  linkText?: string
  statusHtml?: string
  /** 主按钮左侧的次级文字链接（如"打开文章"） */
  secondaryLinkUrl?: string
  secondaryLinkText?: string
  /** 当 linkUrl 缺省时，渲染这段 HTML 替代按钮区（如"请登录后台查看并处理"） */
  actionsFallbackHtml?: string
}) {
  // 主按钮（蓝底白字）；linkText 来自 i18n，但仍 escape 防止文案被改后注入
  const button =
    options.linkUrl && options.linkText
      ? `<a href="${escapeHtml(options.linkUrl)}" style="background-color: #228be6; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">${escapeHtml(options.linkText)}</a>`
      : ''

  // 次链接 + 主按钮放在一行：用 table 控制 20px 间距，邮件客户端对 td 宽度更稳
  const actionsHtml = button
    ? options.secondaryLinkUrl && options.secondaryLinkText
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle"><a href="${escapeHtml(options.secondaryLinkUrl)}" style="color: #228be6; text-decoration: underline;">${escapeHtml(options.secondaryLinkText)}</a></td>
        <td style="width: 20px; min-width: 20px;">&nbsp;</td>
        <td valign="middle">${button}</td>
      </tr></table>`
      : button
    : (options.actionsFallbackHtml ?? '')

  // 主要内容容器：用 table 包裹，邮件客户端对 table 的 border 渲染稳定
  const bodyTable = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: separate; border: 1px solid #e0e0e0; border-radius: 8px;">
    <tr><td style="padding: 8px;">${options.body}</td></tr>
  </table>`

  // 底部区块：内容框已经提供视觉边界，这里只用 margin-top 拉开间距，不再画分隔线
  const footerBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
    <tr><td>
      ${options.statusHtml ?? ''}
      ${actionsHtml}
    </td></tr>
  </table>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; color: #333333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin: 0 auto;">
    <tr><td style="padding: 20px;">
      <h2 style="color: #1a1a1a; margin: 0 0 16px; font-size: 20px; line-height: 1.4;">${options.title}</h2>
      ${options.bodyHeaderHtml ?? ''}
      ${bodyTable}
      ${footerBlock}
    </td></tr>
  </table>
</body>
</html>`
}

async function getNotificationTranslator() {
  const language = await getSetting('language')
  const locale: Locale = isLocale(language) ? language : DEFAULT_LOCALE
  const { t } = await getServerTranslator('admin.notificationEmails', { locale })
  return t
}

/** 新评论通知 */
export async function notifyNewComment(data: {
  authorName: string
  content: string
  contentId: number
  status: 'pending' | 'approved' | 'rejected'
}) {
  const config = parseNotifyConfig(await getSetting('emailNotifyNewComment'))
  if (!config) return

  const recipients = await resolveRecipients(config)
  if (recipients.length === 0) return

  let subject = ''
  try {
    const t = await getNotificationTranslator()
    const siteUrl = await getSafeSiteUrl()

    const row = await maybeFirst(
      db
        .select({ title: contents.title, slug: contents.slug, type: contents.type })
        .from(contents)
        .where(eq(contents.id, data.contentId)),
    )
    const contentTitle = row?.title || t('unknownContentTitle')

    // 拼接前台文章 URL（仅当 siteUrl 已配置且文章是 post 类型时）；slug 必须 encodeURIComponent
    const postUrl =
      siteUrl && row?.slug && row.type === 'post'
        ? `${siteUrl}/posts/${encodeURIComponent(row.slug)}`
        : ''

    // 状态颜色：approved 绿色，pending / rejected 红色
    const statusColor = data.status === 'approved' ? '#2f9e44' : '#c92a2a'
    const statusText =
      data.status === 'approved'
        ? t('newComment.status.approved')
        : data.status === 'rejected'
          ? t('newComment.status.rejected')
          : t('newComment.status.pending')
    const statusHtml = `<p style="margin: 0 0 12px; color: #555;">${escapeHtml(t('newComment.statusLabel'))}<span style="color: ${statusColor}; font-weight: 600;">${escapeHtml(statusText)}</span></p>`

    // 评论正文：用 escapeHtmlWithBreaks 把换行转成 <br>；authorName 防御性截断
    const escapedAuthor = escapeHtml(truncate(data.authorName, 50))
    const escapedContent = escapeHtmlWithBreaks(truncate(data.content, 500))
    // h2 标题与 subject 都基于 contentTitle，但限制不同；subject 单独剥离换行
    const titleForHeading = truncate(contentTitle, 100)
    const titleForSubject = singleLine(truncate(contentTitle, 50))

    subject = t('newComment.subject', { title: titleForSubject })
    const html = buildEmailHtml({
      title: t('newComment.title', { title: escapeHtml(titleForHeading) }),
      bodyHeaderHtml: `<p style="margin: 0 0 8px;"><strong>${escapedAuthor}</strong> ${escapeHtml(t('authorSays'))}</p>`,
      body: `<p style="margin: 0;">${escapedContent}</p>`,
      // siteUrl 未配置时不渲染外链，改用降级提示
      linkUrl: siteUrl ? `${siteUrl}${adminUrl('/comments')}` : undefined,
      linkText: siteUrl ? t('newComment.linkText') : undefined,
      statusHtml,
      secondaryLinkUrl: postUrl || undefined,
      secondaryLinkText: postUrl ? t('newComment.openPostLink') : undefined,
      actionsFallbackHtml: siteUrl
        ? undefined
        : `<p style="margin: 0; color: #555;">${escapeHtml(t('noSiteUrlNotice'))}</p>`,
    })

    const result = await sendEmail(recipients, subject, html)
    await createEmailLog({
      eventType: 'new_comment',
      recipients,
      subject,
      status: result.success ? 'success' : 'fail',
      errorMessage: result.error,
    })
  } catch (error) {
    // 任何异常（db / i18n / siteUrl 缺失 / sendEmail）都记 fail 日志，避免静默
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifyNewComment] failed to send email:', errorMessage)
    await createEmailLog({
      eventType: 'new_comment',
      recipients,
      subject,
      status: 'fail',
      errorMessage,
    }).catch((logError) => {
      // 日志也写不进去时，至少在 server log 留一条痕迹，避免管理员完全瞎
      console.error('[notifyNewComment] failed to write email_logs:', logError)
    })
  }
}

/** 新留言通知 */
export async function notifyNewGuestbook(data: { authorName: string; content: string }) {
  const config = parseNotifyConfig(await getSetting('emailNotifyNewGuestbook'))
  if (!config) return

  const recipients = await resolveRecipients(config)
  if (recipients.length === 0) return

  let subject = ''
  try {
    const t = await getNotificationTranslator()
    const siteUrl = await getSafeSiteUrl()

    // authorName 防御性截断，避免极端长度污染正文
    const escapedAuthor = escapeHtml(truncate(data.authorName, 50))

    subject = t('newGuestbook.subject', {
      authorName: singleLine(truncate(data.authorName, 50)),
    })
    const html = buildEmailHtml({
      title: t('newGuestbook.title'),
      body: `<p style="margin: 0 0 8px;"><strong>${escapedAuthor}</strong> ${escapeHtml(t('authorSays'))}</p>
<p style="margin: 0;">${escapeHtmlWithBreaks(truncate(data.content, 500))}</p>`,
      // siteUrl 未配置时不渲染外链，改用降级提示
      linkUrl: siteUrl ? `${siteUrl}${adminUrl('/guestbook')}` : undefined,
      linkText: siteUrl ? t('newGuestbook.linkText') : undefined,
      actionsFallbackHtml: siteUrl
        ? undefined
        : `<p style="margin: 0; color: #555;">${escapeHtml(t('noSiteUrlNotice'))}</p>`,
    })

    const result = await sendEmail(recipients, subject, html)
    await createEmailLog({
      eventType: 'new_guestbook',
      recipients,
      subject,
      status: result.success ? 'success' : 'fail',
      errorMessage: result.error,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifyNewGuestbook] failed to send email:', errorMessage)
    await createEmailLog({
      eventType: 'new_guestbook',
      recipients,
      subject,
      status: 'fail',
      errorMessage,
    }).catch((logError) => {
      console.error('[notifyNewGuestbook] failed to write email_logs:', logError)
    })
  }
}
