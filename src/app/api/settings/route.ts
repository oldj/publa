import { requireRole } from '@/server/auth'
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
