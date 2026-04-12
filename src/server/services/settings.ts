import { SUPPORTED_LOCALES } from '@/i18n/locales'
import { db } from '@/server/db'
import { maybeFirst } from '@/server/db/query'
import { settings } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { cache } from 'react'

export interface NotifySettingValue {
  enabled: boolean
  userIds: number[]
}

export type SettingValue = string | boolean | number | number[] | NotifySettingValue
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? WidenLiteral<U>[]
        : T extends (infer U)[]
          ? WidenLiteral<U>[]
          : T extends NotifySettingValue
            ? NotifySettingValue
            : T

type SettingValueKind = 'string' | 'boolean' | 'number' | 'numberArray' | 'notify'

const DEFAULT_NOTIFY_SETTING_VALUE: NotifySettingValue = Object.freeze({
  enabled: false,
  userIds: [],
})

export const ADMIN_SETTINGS_KEYS = [
  'siteTitle',
  'siteShortTitle',
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
  'activeThemeId',
  'activeCustomStyleIds',
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

const NUMBER_SETTING_KEYS = ['rssLimit', 'activeThemeId'] as const

const NUMBER_ARRAY_SETTING_KEYS = ['activeCustomStyleIds'] as const

const NOTIFY_SETTING_KEYS = ['emailNotifyNewComment', 'emailNotifyNewGuestbook'] as const

const STRING_SETTING_KEYS = [
  'siteTitle',
  'siteShortTitle',
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
  ...Object.fromEntries(NUMBER_ARRAY_SETTING_KEYS.map((key) => [key, 'numberArray' as const])),
  ...Object.fromEntries(NOTIFY_SETTING_KEYS.map((key) => [key, 'notify' as const])),
})

function defineExplicitDefaultSettings<T extends Record<string, SettingValue>>(input: T) {
  return Object.freeze(input) as Mutable<{
    readonly [K in keyof T]: WidenLiteral<T[K]>
  }>
}

const EXPLICIT_DEFAULT_SETTINGS = defineExplicitDefaultSettings({
  siteTitle: 'Publa',
  siteShortTitle: '',
  siteSlogan: 'Yet Another Amazing Blog',
  siteDescription: '',
  siteUrl: '',
  language: 'zh',
  timezone: 'Asia/Shanghai',
  defaultTheme: 'light',
  enableComment: true,
  showCommentsGlobally: true,
  defaultApprove: false,
  enableRss: true,
  rssTitle: '',
  rssDescription: '',
  rssContent: 'full',
  rssLimit: 20,
  enableGuestbook: true,
  enableSearch: true,
  guestbookWelcome: '',
  footerCopyright: '{SITE_NAME} &copy; {FULL_YEAR}',
  customAfterPostHtml: '',
  customHeadHtml: '',
  customBodyStartHtml: '',
  customBodyEndHtml: '',
  activeCustomStyleIds: [] as number[],
  faviconUrl: '',
  faviconMode: 'default',
  faviconData: '',
  faviconMimeType: '',
  faviconVersion: '',
  emailProvider: '',
  emailResendApiKey: '',
  emailSmtpHost: '',
  emailSmtpPort: '',
  emailSmtpUsername: '',
  emailSmtpPassword: '',
  emailSmtpFrom: '',
  emailSmtpEncryption: 'tls',
  emailNotifyNewComment: DEFAULT_NOTIFY_SETTING_VALUE,
  emailNotifyNewGuestbook: DEFAULT_NOTIFY_SETTING_VALUE,
  storageProvider: '',
  storageS3Endpoint: '',
  storageS3Region: '',
  storageS3Bucket: '',
  storageS3AccessKey: '',
  storageS3SecretKey: '',
  storageOssRegion: '',
  storageOssBucket: '',
  storageOssAccessKeyId: '',
  storageOssAccessKeySecret: '',
  storageCosRegion: '',
  storageCosBucket: '',
  storageCosSecretId: '',
  storageCosSecretKey: '',
  storageR2AccountId: '',
  storageR2Bucket: '',
  storageR2AccessKey: '',
  storageR2SecretKey: '',
  attachmentBaseUrl: '',
  jwtSecret: '',
})

type ExplicitDefaultSettingType = typeof EXPLICIT_DEFAULT_SETTINGS
type ExplicitDefaultSettingKey = keyof ExplicitDefaultSettingType

export type SettingType = ExplicitDefaultSettingType & {
  activeThemeId: number
}

export type SettingKey = keyof SettingType
export type PartialSettingType = Partial<SettingType>
export type LooseSettingType = PartialSettingType & Record<string, unknown>
export type AdminSettingType = Pick<SettingType, (typeof ADMIN_SETTINGS_KEYS)[number]>
export type EmailSettingType = Pick<SettingType, (typeof EMAIL_SETTINGS_KEYS)[number]>
export type EditorSettingType = Pick<SettingType, (typeof EDITOR_SETTINGS_KEYS)[number]>
export type StorageSettingType = Pick<SettingType, (typeof STORAGE_SETTINGS_KEYS)[number]>

export const KNOWN_SETTING_KEYS = Object.freeze(
  Object.keys(SETTING_VALUE_KINDS),
) as readonly SettingKey[]

function cloneSettingValue(value: SettingValue): SettingValue {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') {
    return { ...(value as NotifySettingValue), userIds: [...(value as NotifySettingValue).userIds] }
  }
  return value
}

export function isKnownSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_VALUE_KINDS, key)
}

export function getSettingValueKind(key: string): SettingValueKind {
  return SETTING_VALUE_KINDS[key] ?? 'string'
}

function hasExplicitDefaultSetting<K extends SettingKey>(
  key: K,
): key is Extract<K, ExplicitDefaultSettingKey> {
  return Object.prototype.hasOwnProperty.call(EXPLICIT_DEFAULT_SETTINGS, key)
}

export function getDefaultSettingValue<K extends SettingKey>(key: K): SettingType[K] {
  if (hasExplicitDefaultSetting(key)) {
    return cloneSettingValue(EXPLICIT_DEFAULT_SETTINGS[key]!) as SettingType[K]
  }

  switch (getSettingValueKind(key)) {
    case 'boolean':
      return false as SettingType[K]
    case 'number':
      return 0 as SettingType[K]
    case 'numberArray':
      return [] as unknown as SettingType[K]
    case 'notify':
      return cloneSettingValue(DEFAULT_NOTIFY_SETTING_VALUE) as SettingType[K]
    case 'string':
    default:
      return '' as SettingType[K]
  }
}

export function getDefaultSettingsPayload<K extends SettingKey = SettingKey>(
  keys: readonly K[] = KNOWN_SETTING_KEYS as readonly K[],
): Pick<SettingType, K> {
  const result = {} as Pick<SettingType, K>

  for (const key of keys) {
    const value = getDefaultSettingValue(key)
    result[key] = value
  }

  return result
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
  // language 字段只允许受支持的 locale 枚举值，防止写脏值导致 UI 降级
  if (key === 'language') {
    if (typeof value !== 'string' || !(SUPPORTED_LOCALES as readonly string[]).includes(value)) {
      throw new SettingsValidationError({ invalidValueKeys: [key] })
    }
    return value
  }

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
    case 'numberArray':
      if (!Array.isArray(value)) {
        throw new SettingsValidationError({ invalidValueKeys: [key] })
      }
      for (const item of value) {
        if (typeof item !== 'number' || !Number.isInteger(item)) {
          throw new SettingsValidationError({ invalidValueKeys: [key] })
        }
      }
      return value as number[]
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
  reason: 'INVALID_OBJECT' | 'INVALID_KEYS' | 'INVALID_VALUES' | 'INVALID_PAYLOAD'

  constructor({
    invalidKeys = [],
    invalidValueKeys = [],
    message,
    reason,
  }: {
    invalidKeys?: string[]
    invalidValueKeys?: string[]
    message?: string
    reason?: SettingsValidationError['reason']
  }) {
    const computedReason =
      reason ??
      (invalidKeys.length > 0 && invalidValueKeys.length > 0
        ? 'INVALID_PAYLOAD'
        : invalidKeys.length > 0
          ? 'INVALID_KEYS'
          : invalidValueKeys.length > 0
            ? 'INVALID_VALUES'
            : 'INVALID_PAYLOAD')

    super(message ?? SettingsValidationError.buildMessage(computedReason))
    this.name = 'SettingsValidationError'
    this.invalidKeys = invalidKeys
    this.invalidValueKeys = invalidValueKeys
    this.reason = computedReason
  }

  private static buildMessage(reason: SettingsValidationError['reason']) {
    switch (reason) {
      case 'INVALID_OBJECT':
        return 'Settings payload must be an object'
      case 'INVALID_KEYS':
        return 'Unsupported settings keys'
      case 'INVALID_VALUES':
        return 'Invalid settings values'
      case 'INVALID_PAYLOAD':
      default:
        return 'Invalid settings payload'
    }
  }
}

export function isSettingsValidationError(error: unknown): error is SettingsValidationError {
  return error instanceof SettingsValidationError
}

/** 统一校验并规范化设置 payload，供路由和导入导出复用 */
export function normalizeSettingsPayload(input: unknown): Record<string, SettingValue>
export function normalizeSettingsPayload<K extends SettingKey>(
  input: unknown,
  allowedKeys: readonly K[],
): Partial<Pick<SettingType, K>>
export function normalizeSettingsPayload(
  input: unknown,
  allowedKeys?: readonly string[],
): Record<string, SettingValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SettingsValidationError({ reason: 'INVALID_OBJECT' })
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
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingType[K] | null>
export async function getSetting(key: string): Promise<unknown>
export async function getSetting(key: string): Promise<unknown> {
  const row = await maybeFirst(db.select().from(settings).where(eq(settings.key, key)).limit(1))
  if (!row) return null
  return deserializeSettingValue(key, row.value)
}

/**
 * 获取所有设置。使用 React cache 做请求级记忆化，同一次服务端渲染里无论被多少层布局调用，
 * 都只会真正查询数据库一次；写入（setSetting/updateSettings）不会走这条缓存，因此不影响读写一致性。
 */
export const getAllSettings = cache(async (): Promise<LooseSettingType> => {
  const rows = await db.select().from(settings)
  const result: LooseSettingType = {}
  for (const row of rows) {
    result[row.key] = deserializeSettingValue(row.key, row.value)
  }
  return result
})

export function pickSettings<K extends SettingKey>(
  allSettings: LooseSettingType,
  keys: readonly K[],
): Pick<SettingType, K> {
  const result = {} as Pick<SettingType, K>

  for (const key of keys) {
    if (allSettings[key] !== undefined) {
      result[key] = allSettings[key] as SettingType[K]
    } else {
      // 按 key 类型给合适的默认值，避免布尔/数值/通知 key 拿到空字符串后校验失败
      const kind = getSettingValueKind(key)
      result[key] = (
        kind === 'boolean'
          ? false
          : kind === 'number'
            ? 0
            : kind === 'numberArray'
              ? []
              : kind === 'notify'
                ? cloneSettingValue(DEFAULT_NOTIFY_SETTING_VALUE)
                : ''
      ) as SettingType[K]
    }
  }

  return result
}

/** 设置单个值 */
export async function setSetting<K extends SettingKey>(key: K, value: SettingType[K]) {
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
export async function updateSettings(data: PartialSettingType) {
  for (const key of Object.keys(data) as SettingKey[]) {
    const value = data[key]
    if (value !== undefined) {
      await setSetting(key, value)
    }
  }
}
