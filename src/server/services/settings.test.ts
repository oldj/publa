import * as schema from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const {
  SettingsValidationError,
  deserializeSettingValue,
  getAllSettings,
  getSetting,
  normalizeSettingsPayload,
  pickSettings,
  setSetting,
  toBool,
  toStr,
} = await import('./settings')

describe('settings service', () => {
  beforeEach(async () => {
    await setupTestDb()
  })

  it('字符串设置写入时保留原始字符串', async () => {
    await setSetting('siteTitle', 'Publa')

    const row = await testDb
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'siteTitle'))
      .limit(1)

    expect(row[0]?.value).toBe('Publa')
    expect(await getSetting('siteTitle')).toBe('Publa')
  })

  it('兼容历史 JSON 编码的字符串值', async () => {
    await testDb.insert(schema.settings).values({ key: 'siteTitle', value: '"Publa"' })

    expect(await getSetting('siteTitle')).toBe('Publa')
  })

  it('布尔和数字设置按真实类型读写', async () => {
    await setSetting('enableComment', false)
    await setSetting('rssLimit', 20)

    const rows = await testDb.select().from(schema.settings)
    const map = Object.fromEntries(rows.map((item) => [item.key, item.value]))
    const settings = await getAllSettings()

    expect(map.enableComment).toBe('false')
    expect(map.rssLimit).toBe('20')
    expect(settings.enableComment).toBe(false)
    expect(settings.rssLimit).toBe(20)
  })

  it('通知设置按对象读写', async () => {
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1, 2] })

    const row = await testDb
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'emailNotifyNewComment'))
      .limit(1)

    expect(row[0]?.value).toBe('{"enabled":true,"userIds":[1,2]}')
    expect(await getSetting('emailNotifyNewComment')).toEqual({
      enabled: true,
      userIds: [1, 2],
    })
  })

  it('规范化 payload 时兼容旧字符串格式', () => {
    expect(
      normalizeSettingsPayload({
        siteTitle: 'Publa',
        enableComment: 'false',
        rssLimit: '20',
        emailNotifyNewComment: '{"enabled":true,"userIds":[1,2]}',
        k1: 'v1',
      }),
    ).toEqual({
      siteTitle: 'Publa',
      enableComment: false,
      rssLimit: 20,
      emailNotifyNewComment: {
        enabled: true,
        userIds: [1, 2],
      },
      k1: 'v1',
    })
  })

  it('规范化 payload 时拒绝向标量设置写入对象', () => {
    expect(() =>
      normalizeSettingsPayload({
        siteTitle: { text: 'Publa' },
      }),
    ).toThrow(SettingsValidationError)
  })

  it('规范化 payload 时根据白名单拒绝非法 key', () => {
    expect(() =>
      normalizeSettingsPayload({ siteTitle: 'Publa', jwtSecret: 'hack' }, ['siteTitle']),
    ).toThrow(SettingsValidationError)
  })

  it('规范化 payload 拒绝非对象输入', () => {
    expect(() => normalizeSettingsPayload(null)).toThrow(SettingsValidationError)
    expect(() => normalizeSettingsPayload([1, 2])).toThrow(SettingsValidationError)
    expect(() => normalizeSettingsPayload('string')).toThrow(SettingsValidationError)
  })
})

describe('toBool', () => {
  it('识别布尔值和布尔字符串', () => {
    expect(toBool(true)).toBe(true)
    expect(toBool(false)).toBe(false)
    expect(toBool('true')).toBe(true)
    expect(toBool('false')).toBe(false)
  })

  it('null/undefined 返回默认值', () => {
    expect(toBool(null)).toBe(true)
    expect(toBool(undefined)).toBe(true)
    expect(toBool(null, false)).toBe(false)
    expect(toBool(undefined, false)).toBe(false)
  })

  it('非布尔值返回默认值', () => {
    expect(toBool(0)).toBe(true)
    expect(toBool('')).toBe(true)
    expect(toBool('yes')).toBe(true)
    expect(toBool(0, false)).toBe(false)
  })
})

describe('toStr', () => {
  it('字符串原样返回', () => {
    expect(toStr('hello')).toBe('hello')
    expect(toStr('')).toBe('')
  })

  it('null/undefined 返回默认值', () => {
    expect(toStr(null)).toBe('')
    expect(toStr(undefined)).toBe('')
    expect(toStr(null, 'fallback')).toBe('fallback')
  })

  it('其他类型转为字符串', () => {
    expect(toStr(123)).toBe('123')
    expect(toStr(true)).toBe('true')
  })
})

describe('pickSettings', () => {
  it('存在的 key 原样返回', () => {
    const result = pickSettings({ siteTitle: 'Publa', enableComment: true }, ['siteTitle', 'enableComment'])
    expect(result).toEqual({ siteTitle: 'Publa', enableComment: true })
  })

  it('缺失的布尔 key 默认为 false', () => {
    const result = pickSettings({}, ['enableComment', 'showCommentsGlobally'])
    expect(result.enableComment).toBe(false)
    expect(result.showCommentsGlobally).toBe(false)
  })

  it('缺失的数值 key 默认为 0', () => {
    const result = pickSettings({}, ['rssLimit'])
    expect(result.rssLimit).toBe(0)
  })

  it('缺失的字符串 key 默认为空字符串', () => {
    const result = pickSettings({}, ['siteTitle'])
    expect(result.siteTitle).toBe('')
  })
})

describe('deserializeSettingValue', () => {
  it('损坏的布尔值回退为原始字符串', () => {
    expect(deserializeSettingValue('enableComment', 'corrupted')).toBe('corrupted')
  })

  it('损坏的数值回退为原始字符串', () => {
    expect(deserializeSettingValue('rssLimit', 'abc')).toBe('abc')
  })

  it('损坏的通知配置回退为原始字符串', () => {
    expect(deserializeSettingValue('emailNotifyNewComment', 'not-json')).toBe('not-json')
  })

  it('字符串值中恰好是 JSON 数字时保留原始字符串', () => {
    // emailSmtpPort 是 string 类型的 key，存了 "587" 不应被解析成数字
    expect(deserializeSettingValue('emailSmtpPort', '587')).toBe('587')
  })
})
