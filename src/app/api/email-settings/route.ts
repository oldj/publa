import { requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { jsonSettingsValidationError } from '@/server/lib/settings-error'
import {
  EMAIL_SETTINGS_KEYS,
  type EmailSettingType,
  getAllSettings,
  isSettingsValidationError,
  normalizeSettingsPayload,
  pickSettings,
  updateSettings,
} from '@/server/services/settings'
import { NextRequest } from 'next/server'

const SENSITIVE_KEYS = [
  'emailResendApiKey',
  'emailSmtpPassword',
] as const satisfies readonly (keyof EmailSettingType)[]
const MASK = '••••••••'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), EMAIL_SETTINGS_KEYS)
  // 敏感字段仅返回掩码，不暴露原始值
  for (const key of SENSITIVE_KEYS) {
    if (data[key]) data[key] = MASK
  }
  return jsonSuccess(data)
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 敏感字段：掩码或空值表示未修改，跳过以避免覆盖原值
  const filtered = { ...(body as Record<string, unknown>) }
  for (const key of SENSITIVE_KEYS) {
    if (!filtered[key] || filtered[key] === MASK) delete filtered[key]
  }

  try {
    const normalized = normalizeSettingsPayload(filtered, EMAIL_SETTINGS_KEYS)
    await updateSettings(normalized)
  } catch (error) {
    if (isSettingsValidationError(error)) {
      return jsonSettingsValidationError(error, request)
    }
    throw error
  }

  return jsonSuccess()
}
