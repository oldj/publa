import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  ADMIN_SETTINGS_KEYS,
  getAllSettings,
  pickSettings,
  updateSettings,
} from '@/server/services/settings'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), ADMIN_SETTINGS_KEYS)
  return NextResponse.json({ success: true, data })
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) {
    return guard.response
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const invalidKeys = Object.keys(body).filter((key) => !ADMIN_SETTINGS_KEYS.includes(key as any))
  if (invalidKeys.length > 0) {
    return NextResponse.json(
      {
        success: false,
        code: 'VALIDATION_ERROR',
        message: `不支持修改以下设置项：${invalidKeys.join(', ')}`,
      },
      { status: 400 },
    )
  }

  await updateSettings(body)
  logActivity(request, guard.user.id, 'update_settings')
  return NextResponse.json({ success: true })
}
