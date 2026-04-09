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

  it('��符串设置统一 JSON 编码存储', async () => {
    await setSetting('siteTitle', 'Publa')

    const row = await testDb
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'siteTitle'))
      .limit(1)

    // DB 中存的是 JSON 编码后的字符串
    expect(row[0]?.value).toBe('"Publa"')
    expect(await getSetting('siteTitle')).toBe('Publa')
  })

  it('布尔和数字设置按真���类型读写', async () => {
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

  it('通知设置按对象读��', async () => {
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

  it('规范化 payload 接受原生类型', () => {
    expect(
      normalizeSettingsPayload({
        siteTitle: 'Publa',
        enableComment: false,
        rssLimit: 20,
        emailNotifyNewComment: { enabled: true, userIds: [1, 2] },
        k1: 'v1',
      }),
    ).toEqual({
      siteTitle: 'Publa',
      enableComment: false,
      rssLimit: 20,
      emailNotifyNewComment: { enabled: true, userIds: [1, 2] },
      k1: 'v1',
    })
  })

  it('规范化 payload 时拒绝向布尔设置写入字符串', () => {
    expect(() =>
      normalizeSettingsPayload({ enableComment: 'false' }),
    ).toThrow(SettingsValidationError)
  })

  it('规范化 payload 时拒��向标量设置写入对象', () => {
    expect(() =>
      normalizeSettingsPayload({
        siteTitle: { text: 'Publa' },
      }),
    ).toThrow(SettingsValidationError)
  })

  it('规范化 payload 时根��白名单拒绝非�� key', () => {
    expect(() =>
      normalizeSettingsPayload({ siteTitle: 'Publa', jwtSecret: 'hack' }, ['siteTitle']),
    ).toThrow(SettingsValidationError)
  })

  it('规范��� payload 拒绝非对象输入', () => {
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

  it('非布尔值返回默��值', () => {
    expect(toBool(0)).toBe(true)
    expect(toBool('')).toBe(true)
    expect(toBool('yes')).toBe(true)
    expect(toBool(0, false)).toBe(false)
  })
})

describe('toStr', () => {
  it('字符串原���返回', () => {
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
    const result = pickSettings({ siteTitle: 'Publa', enableComment: true }, [
      'siteTitle',
      'enableComment',
    ])
    expect(result).toEqual({ siteTitle: 'Publa', enableComment: true })
  })

  it('缺失的���尔 key 默认为 false', () => {
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
  it('正确反序列化各类型', () => {
    expect(deserializeSettingValue('siteTitle', '"Publa"')).toBe('Publa')
    expect(deserializeSettingValue('enableComment', 'false')).toBe(false)
    expect(deserializeSettingValue('rssLimit', '20')).toBe(20)
    expect(deserializeSettingValue('emailNotifyNewComment', '{"enabled":true,"userIds":[1]}')).toEqual({
      enabled: true,
      userIds: [1],
    })
  })
})
