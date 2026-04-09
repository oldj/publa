import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { settings } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export interface NotifySettingValue {
  enabled: boolean
  userIds: number[]
}

export type SettingValue = string | boolean | number | NotifySettingValue

type SettingValueKind = 'string' | 'boolean' | 'number' | 'notify'

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
  'enableSearch',
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

export const STORAGE_SETTINGS_KEYS = [
  'storageProvider',
  'storageS3Endpoint',
  'storageS3Region',
  'storageS3Bucket',
  'storageS3AccessKey',
  'storageS3SecretKey',
  'storageOssRegion',
  'storageOssBucket',
  'storageOssAccessKeyId',
  'storageOssAccessKeySecret',
  'storageCosRegion',
  'storageCosBucket',
  'storageCosSecretId',
  'storageCosSecretKey',
  'storageR2AccountId',
  'storageR2Bucket',
  'storageR2AccessKey',
  'storageR2SecretKey',
  'attachmentBaseUrl',
] as const

const BOOLEAN_SETTING_KEYS = [
  'enableComment',
  'showCommentsGlobally',
  'defaultApprove',
  'enableRss',
  'enableGuestbook',
  'enableSearch',
] as const

const NUMBER_SETTING_KEYS = ['rssLimit'] as const

const NOTIFY_SETTING_KEYS = ['emailNotifyNewComment', 'emailNotifyNewGuestbook'] as const

const STRING_SETTING_KEYS = [
  'siteTitle',
  'siteSlogan',
  'siteDescription',
  'siteUrl',
  'language',
  'timezone',
  'defaultTheme',
  'rssTitle',
  'rssDescription',
  'rssContent',
  'guestbookWelcome',
  'footerCopyright',
  'customAfterPostHtml',
  'customHeadHtml',
  'customBodyStartHtml',
  'customBodyEndHtml',
  'emailProvider',
  'emailResendApiKey',
  'emailSmtpHost',
  'emailSmtpPort',
  'emailSmtpUsername',
  'emailSmtpPassword',
  'emailSmtpFrom',
  'emailSmtpEncryption',
  ...STORAGE_SETTINGS_KEYS,
  'faviconUrl',
  'faviconMode',
  'faviconData',
  'faviconMimeType',
  'faviconVersion',
  'jwtSecret',
] as const

const SETTING_VALUE_KINDS: Record<string, SettingValueKind> = Object.freeze({
  ...Object.fromEntries(STRING_SETTING_KEYS.map((key) => [key, 'string' as const])),
  ...Object.fromEntries(BOOLEAN_SETTING_KEYS.map((key) => [key, 'boolean' as const])),
  ...Object.fromEntries(NUMBER_SETTING_KEYS.map((key) => [key, 'number' as const])),
  ...Object.fromEntries(NOTIFY_SETTING_KEYS.map((key) => [key, 'notify' as const])),
})

export function getSettingValueKind(key: string): SettingValueKind {
  return SETTING_VALUE_KINDS[key] ?? 'string'
}

function validateNotifyValue(value: unknown): NotifySettingValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SettingsValidationError({ invalidValueKeys: [] })
  }
  const obj = value as Record<string, unknown>
  if (typeof obj.enabled !== 'boolean' || !Array.isArray(obj.userIds)) {
    throw new SettingsValidationError({ invalidValueKeys: [] })
  }
  for (const id of obj.userIds) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      throw new SettingsValidationError({ invalidValueKeys: [] })
    }
  }
  return { enabled: obj.enabled, userIds: obj.userIds as number[] }
}

function normalizeSettingValue(key: string, value: unknown): SettingValue {
  switch (getSettingValueKind(key)) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new SettingsValidationError({ invalidValueKeys: [key] })
      }
      return value
    case 'number':
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new SettingsValidationError({ invalidValueKeys: [key] })
      }
      return value
    case 'notify':
      try {
        return validateNotifyValue(value)
      } catch {
        throw new SettingsValidationError({ invalidValueKeys: [key] })
      }
    case 'string':
    default:
      if (typeof value !== 'string') {
        throw new SettingsValidationError({ invalidValueKeys: [key] })
      }
      return value
  }
}

/** 统一使用 JSON.stringify 序列化 */
export function serializeSettingValue(_key: string, value: unknown): string {
  return JSON.stringify(value)
}

/** 统一使用 JSON.parse 反序列化，兼容尚未迁移的旧格式纯文本 */
export function deserializeSettingValue(_key: string, raw: string): SettingValue {
  try {
    return JSON.parse(raw) as SettingValue
  } catch {
    return raw
  }
}

export class SettingsValidationError extends Error {
  invalidKeys: string[]
  invalidValueKeys: string[]

  constructor({
    invalidKeys = [],
    invalidValueKeys = [],
    message,
  }: {
    invalidKeys?: string[]
    invalidValueKeys?: string[]
    message?: string
  }) {
    super(message ?? SettingsValidationError.buildMessage(invalidKeys, invalidValueKeys))
    this.name = 'SettingsValidationError'
    this.invalidKeys = invalidKeys
    this.invalidValueKeys = invalidValueKeys
  }

  private static buildMessage(invalidKeys: string[], invalidValueKeys: string[]) {
    const messages: string[] = []

    if (invalidKeys.length > 0) {
      messages.push(`不支持修改以下设置项：${invalidKeys.join(', ')}`)
    }
    if (invalidValueKeys.length > 0) {
      messages.push(`以下设置项的值类型不合法：${invalidValueKeys.join(', ')}`)
    }

    return messages.join('；') || '设置数据不合法'
  }
}

export function isSettingsValidationError(error: unknown): error is SettingsValidationError {
  return error instanceof SettingsValidationError
}

/** 统一校验并规范化设置 payload，供路由和导入导出复用 */
export function normalizeSettingsPayload(
  input: unknown,
  allowedKeys?: readonly string[],
): Record<string, SettingValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SettingsValidationError({ message: '设置数据必须是对象' })
  }

  const invalidKeys: string[] = []
  const invalidValueKeys: string[] = []
  const normalized: Record<string, SettingValue> = {}

  for (const [key, value] of Object.entries(input)) {
    if (allowedKeys && !allowedKeys.includes(key)) {
      invalidKeys.push(key)
      continue
    }

    try {
      normalized[key] = normalizeSettingValue(key, value)
    } catch (error) {
      if (isSettingsValidationError(error)) {
        invalidValueKeys.push(key)
        continue
      }
      throw error
    }
  }

  if (invalidKeys.length > 0 || invalidValueKeys.length > 0) {
    throw new SettingsValidationError({ invalidKeys, invalidValueKeys })
  }

  return normalized
}

/** 将 unknown 转为布尔值，兼容 true/"true"/false/"false" */
export function toBool(value: unknown, defaultValue = true): boolean {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return defaultValue
}

/** 将 unknown 转为字符串 */
export function toStr(value: unknown, defaultValue = ''): string {
  if (value == null) return defaultValue
  if (typeof value === 'string') return value
  return String(value)
}

/** 获取单个设置 */
export async function getSetting(key: string): Promise<unknown> {
  const row = await maybeFirst(db.select().from(settings).where(eq(settings.key, key)).limit(1))
  if (!row) return null
  return deserializeSettingValue(key, row.value)
}

/** 获取所有设置 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings)
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    result[row.key] = deserializeSettingValue(row.key, row.value)
  }
  return result
}

export function pickSettings(
  allSettings: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const key of keys) {
    if (allSettings[key] !== undefined) {
      result[key] = allSettings[key]
    } else {
      // 按 key 类型给合适的默认值，避免布尔/数值 key 拿到空字符串后校验失败
      const kind = getSettingValueKind(key)
      result[key] = kind === 'boolean' ? false : kind === 'number' ? 0 : ''
    }
  }

  return result
}

/** 设置单个值 */
export async function setSetting(key: string, value: SettingValue) {
  normalizeSettingValue(key, value)
  const serialized = serializeSettingValue(key, value)
  const existing = await maybeFirst(
    db.select().from(settings).where(eq(settings.key, key)).limit(1),
  )
  if (existing) {
    await db.update(settings).set({ value: serialized }).where(eq(settings.key, key))
  } else {
    await db.insert(settings).values({ key, value: serialized })
  }
}

/** 批量更新设置 */
export async function updateSettings(data: Record<string, SettingValue>) {
  for (const [key, value] of Object.entries(data)) {
    await setSetting(key, value)
  }
}
