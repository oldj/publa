import dayjs from 'dayjs'

export const DATE_FMT = 'YYYY-MM-DD'
export const PRESET_DAYS = [7, 30, 90, 365] as const
export type PresetDays = (typeof PRESET_DAYS)[number]

/**
 * 持久化的"上次选择"。preset 类型只记天数，下次打开按当时 today 重算窗口；
 * custom 类型记字面起止，原样恢复。
 */
export type SavedRange =
  | { kind: 'preset'; days: PresetDays }
  | { kind: 'custom'; from: string; to: string }

export interface DailyView {
  date: string
  viewCount: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** today 的字符串形式由调用方传入，使函数纯化、可测 */
export function daysAgoFrom(today: string, days: number): string {
  return dayjs(today)
    .subtract(days - 1, 'day')
    .format(DATE_FMT)
}

/** 在 [from, to] 内按天补齐零值，确保折线图 X 轴连续 */
export function fillRange(items: DailyView[], from: string, to: string): DailyView[] {
  const start = dayjs(from)
  const end = dayjs(to)
  // 非法日期会让循环里的 isAfter 永远返回 false 并陷入死循环，先短路返回空
  if (!start.isValid() || !end.isValid()) return []
  const map = new Map(items.map((it) => [it.date, it.viewCount]))
  const out: DailyView[] = []
  for (let d = start; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
    const key = d.format(DATE_FMT)
    out.push({ date: key, viewCount: map.get(key) ?? 0 })
  }
  return out
}

/** 解析并校验存储中的字符串；任何不合法都返回 null */
export function parseSaved(raw: string | null): SavedRange | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (obj.kind === 'preset' && typeof obj.days === 'number') {
    if ((PRESET_DAYS as readonly number[]).includes(obj.days)) {
      return { kind: 'preset', days: obj.days as PresetDays }
    }
    return null
  }
  if (
    obj.kind === 'custom' &&
    typeof obj.from === 'string' &&
    typeof obj.to === 'string' &&
    DATE_RE.test(obj.from) &&
    DATE_RE.test(obj.to)
  ) {
    return { kind: 'custom', from: obj.from, to: obj.to }
  }
  return null
}

export function serializeSaved(saved: SavedRange): string {
  return JSON.stringify(saved)
}

/** 把 saved 还原成具体的日期区间；preset 按 today 重算 */
export function rangeFromSaved(saved: SavedRange | null, today: string): [string, string] {
  if (saved?.kind === 'preset') return [daysAgoFrom(today, saved.days), today]
  if (saved?.kind === 'custom') return [saved.from, saved.to]
  return [daysAgoFrom(today, 30), today]
}

/**
 * 如果新区间恰好等于以 today 为终点的某个 preset 窗口，返回对应天数；
 * 否则返回 null（视为用户手选）。
 */
export function matchPresetDays(
  next: [string | null, string | null],
  today: string,
): PresetDays | null {
  const [from, to] = next
  if (!from || !to) return null
  if (to !== today) return null
  for (const days of PRESET_DAYS) {
    if (from === daysAgoFrom(today, days)) return days
  }
  return null
}
