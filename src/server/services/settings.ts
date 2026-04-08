import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { settings } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export const ADMIN_SETTINGS_KEYS = [
  'siteTitle',
  'siteSlogan',
  'siteDescription',
  'siteUrl',
  'language',
  'timezone',
  'defaultTheme',
  'enableComment',
  'showCommentsGlobally',
  'defaultApprove',
  'enableRss',
  'rssTitle',
  'rssDescription',
  'rssContent',
  'rssLimit',
  'enableGuestbook',
  'guestbookWelcome',
  'footerCopyright',
  'customAfterPostHtml',
  'customHeadHtml',
  'customBodyStartHtml',
  'customBodyEndHtml',
] as const

export const EMAIL_SETTINGS_KEYS = [
  'emailProvider',
  'emailResendApiKey',
  'emailSmtpHost',
  'emailSmtpPort',
  'emailSmtpUsername',
  'emailSmtpPassword',
  'emailSmtpFrom',
  'emailSmtpEncryption',
  'emailNotifyNewComment',
  'emailNotifyNewGuestbook',
] as const

export const EDITOR_SETTINGS_KEYS = ['enableComment', 'showCommentsGlobally'] as const

/** 获取单个设置 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await maybeFirst(db.select().from(settings).where(eq(settings.key, key)).limit(1))
  return row?.value ?? null
}

/** 获取所有设置 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings)
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

export function pickSettings(
  allSettings: Record<string, string>,
  keys: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const key of keys) {
    result[key] = allSettings[key] ?? ''
  }

  return result
}

/** 设置单个值 */
export async function setSetting(key: string, value: string) {
  const existing = await maybeFirst(
    db.select().from(settings).where(eq(settings.key, key)).limit(1),
  )
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value })
  }
}

/** 批量更新设置 */
export async function updateSettings(data: Record<string, string>) {
  for (const [key, value] of Object.entries(data)) {
    await setSetting(key, value)
  }
}
