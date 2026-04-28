import { describe, expect, it } from 'vitest'
import {
  daysAgoFrom,
  fillRange,
  matchPresetDays,
  parseSaved,
  PRESET_DAYS,
  rangeFromSaved,
  serializeSaved,
  type SavedRange,
} from './PostTrendModal.utils'

describe('daysAgoFrom', () => {
  it('包含端点：days=1 返回当天', () => {
    expect(daysAgoFrom('2026-04-28', 1)).toBe('2026-04-28')
  })

  it('days=7 返回 6 天前的字符串', () => {
    expect(daysAgoFrom('2026-04-28', 7)).toBe('2026-04-22')
  })

  it('跨月正确回退', () => {
    expect(daysAgoFrom('2026-03-02', 7)).toBe('2026-02-24')
  })
})

describe('fillRange', () => {
  it('稀疏数据按天补 0，保持升序', () => {
    const filled = fillRange(
      [
        { date: '2026-04-26', viewCount: 3 },
        { date: '2026-04-28', viewCount: 5 },
      ],
      '2026-04-25',
      '2026-04-28',
    )
    expect(filled).toEqual([
      { date: '2026-04-25', viewCount: 0 },
      { date: '2026-04-26', viewCount: 3 },
      { date: '2026-04-27', viewCount: 0 },
      { date: '2026-04-28', viewCount: 5 },
    ])
  })

  it('单日区间返回单行', () => {
    expect(fillRange([], '2026-04-28', '2026-04-28')).toEqual([
      { date: '2026-04-28', viewCount: 0 },
    ])
  })

  it('from > to 返回空数组', () => {
    expect(fillRange([], '2026-04-29', '2026-04-28')).toEqual([])
  })

  it('非法日期短路返回空数组，不会死循环', () => {
    expect(fillRange([], 'not-a-date', '2026-04-28')).toEqual([])
    expect(fillRange([], '2026-04-28', 'not-a-date')).toEqual([])
    expect(fillRange([], 'foo', 'bar')).toEqual([])
  })
})

describe('parseSaved', () => {
  it('null/空字符串返回 null', () => {
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved('')).toBeNull()
  })

  it('非 JSON 返回 null', () => {
    expect(parseSaved('not json')).toBeNull()
  })

  it('合法的 preset 通过', () => {
    expect(parseSaved('{"kind":"preset","days":30}')).toEqual({ kind: 'preset', days: 30 })
  })

  it('未知 days 拒绝', () => {
    expect(parseSaved('{"kind":"preset","days":42}')).toBeNull()
  })

  it('合法的 custom 通过', () => {
    expect(parseSaved('{"kind":"custom","from":"2026-04-01","to":"2026-04-28"}')).toEqual({
      kind: 'custom',
      from: '2026-04-01',
      to: '2026-04-28',
    })
  })

  it('日期格式不合规拒绝', () => {
    expect(parseSaved('{"kind":"custom","from":"2026/4/1","to":"2026-04-28"}')).toBeNull()
    expect(parseSaved('{"kind":"custom","from":"2026-04-01","to":"yesterday"}')).toBeNull()
  })

  it('未知 kind 拒绝', () => {
    expect(parseSaved('{"kind":"other","days":7}')).toBeNull()
  })

  it('数组等非对象拒绝', () => {
    expect(parseSaved('[1,2]')).toBeNull()
    expect(parseSaved('null')).toBeNull()
  })
})

describe('serializeSaved → parseSaved 往返', () => {
  it('preset 与 custom 都能 round-trip', () => {
    const samples: SavedRange[] = [
      { kind: 'preset', days: 7 },
      { kind: 'preset', days: 365 },
      { kind: 'custom', from: '2026-01-01', to: '2026-01-31' },
    ]
    for (const s of samples) {
      expect(parseSaved(serializeSaved(s))).toEqual(s)
    }
  })
})

describe('rangeFromSaved', () => {
  const today = '2026-04-28'

  it('null 返回默认 30 天窗口', () => {
    expect(rangeFromSaved(null, today)).toEqual(['2026-03-30', '2026-04-28'])
  })

  it('preset 按 today 重算窗口', () => {
    expect(rangeFromSaved({ kind: 'preset', days: 7 }, today)).toEqual([
      '2026-04-22',
      '2026-04-28',
    ])
  })

  it('custom 原样返回字面值，不受 today 影响', () => {
    expect(rangeFromSaved({ kind: 'custom', from: '2026-01-01', to: '2026-01-15' }, today)).toEqual(
      ['2026-01-01', '2026-01-15'],
    )
  })
})

describe('matchPresetDays', () => {
  const today = '2026-04-28'

  it.each(PRESET_DAYS)('当区间正好等于 last %i d 窗口时匹配该天数', (days) => {
    const next: [string, string] = [daysAgoFrom(today, days), today]
    expect(matchPresetDays(next, today)).toBe(days)
  })

  it('终点不是 today 时返回 null（即使天数 delta 等于 preset）', () => {
    // 7 天窗口但终点是昨天
    expect(matchPresetDays(['2026-04-21', '2026-04-27'], today)).toBeNull()
  })

  it('天数不在 PRESET_DAYS 中返回 null', () => {
    // 14 天 ≠ 7/30/90/365
    expect(matchPresetDays(['2026-04-15', today], today)).toBeNull()
  })

  it('任一端为 null 返回 null', () => {
    expect(matchPresetDays([null, today], today)).toBeNull()
    expect(matchPresetDays(['2026-04-22', null], today)).toBeNull()
  })
})
