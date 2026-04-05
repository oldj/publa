import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import {
  EMAIL_SETTINGS_KEYS,
  getAllSettings,
  pickSettings,
  updateSettings,
} from '@/server/services/settings'
import { NextRequest, NextResponse } from 'next/server'

const SENSITIVE_KEYS = ['emailResendApiKey', 'emailSmtpPassword']
const MASK = '••••••••'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const data = pickSettings(await getAllSettings(), EMAIL_SETTINGS_KEYS)
  // 敏感字段仅返回掩码，不暴露原始值
  for (const key of SENSITIVE_KEYS) {
    if (data[key]) data[key] = MASK
  }
  return NextResponse.json({ success: true, data })
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const invalidKeys = Object.keys(body).filter((key) => !EMAIL_SETTINGS_KEYS.includes(key as any))
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

  // 敏感字段：掩码或空值表示未修改，跳过以避免覆盖原值
  const filtered = { ...body }
  for (const key of SENSITIVE_KEYS) {
    if (!filtered[key] || filtered[key] === MASK) delete filtered[key]
  }

  await updateSettings(filtered)
  return NextResponse.json({ success: true })
}
