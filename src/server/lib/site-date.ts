import { getSetting } from '@/server/services/settings'

/**
 * 用 formatToParts 提取年月日，避免不同 ICU 版本下 .format() 输出格式漂移
 */
function formatYmd(now: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

/**
 * 返回站点时区下的 'YYYY-MM-DD'。
 * 时区取自 settings 表 `timezone`，未设置或非法值时回退服务器本地时区。
 */
export async function getSiteDateString(now: Date = new Date()): Promise<string> {
  const raw = await getSetting('timezone')
  const tz = typeof raw === 'string' ? raw.trim() : ''
  try {
    return formatYmd(now, tz || undefined)
  } catch {
    return formatYmd(now, undefined)
  }
}
