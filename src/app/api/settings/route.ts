import { requireRecentReauth, requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { jsonSettingsValidationError } from '@/server/lib/settings-error'
import { logActivity } from '@/server/services/activity-logs'
import {
  ADMIN_SETTINGS_KEYS,
  getAllSettings,
  isSettingsValidationError,
  normalizeSettingsPayload,
  pickSettings,
  updateSettings,
} from '@/server/services/settings'
import { NextRequest } from 'next/server'

// 触发二次验证的敏感字段：
// - 自定义 HTML / footer 直接进入页面 DOM，被改写后可注入脚本或钓鱼内容；
// - siteUrl 影响 RSS、邮件回链、canonical 等所有外部跳转源，被改写会扩散到站外。
// 存储 / 邮件 / favicon 等其他敏感配置走各自路由，已在那里独立接入 requireRecentReauth。
const REAUTH_SETTING_KEYS = [
  'customHeadHtml',
  'customAfterPostHtml',
  'customBodyStartHtml',
  'customBodyEndHtml',
  'footerCopyright',
  'siteUrl',
] as const

function hasSensitiveSettingChange(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  // 用 JSON.stringify 做结构性比较：当前白名单全是字符串，未来若加入数组/对象类型字段
  // （例如 activeCustomStyleIds 之类），不会因为 String([1,2]) === '1,2' 这种降级出现误判。
  for (const key of REAUTH_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue
    if (JSON.stringify(next[key] ?? null) !== JSON.stringify(current[key] ?? null)) return true
  }
  return false
}

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), ADMIN_SETTINGS_KEYS)
  return jsonSuccess(data)
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) {
    return guard.response
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  try {
    const normalized = normalizeSettingsPayload(body, ADMIN_SETTINGS_KEYS)
    const current = await getAllSettings()
    if (hasSensitiveSettingChange(current, normalized)) {
      const reauth = await requireRecentReauth(guard.user, request)
      if (!reauth.ok) return reauth.response
    }
    await updateSettings(normalized)
  } catch (error) {
    if (isSettingsValidationError(error)) {
      return jsonSettingsValidationError(error, request)
    }
    throw error
  }

  await logActivity(request, guard.user.id, 'update_settings')
  return jsonSuccess()
}
