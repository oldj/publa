import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  createCustomStyle,
  listCustomStyles,
  reorderCustomStyles,
} from '@/server/services/custom-styles'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const rows = await listCustomStyles()
  return NextResponse.json({ success: true, data: rows })
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  if (body.action === 'reorder') {
    if (!Array.isArray(body.ids)) {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '排序数据无效' },
        { status: 400 },
      )
    }

    try {
      await reorderCustomStyles(body.ids)
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json(
        { success: false, code: 'VALIDATION_ERROR', message: '排序数据无效' },
        { status: 400 },
      )
    }
  }

  const { name, css } = body
  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '名称不能为空' },
      { status: 400 },
    )
  }

  const row = await createCustomStyle({ name, css: typeof css === 'string' ? css : '' })
  await logActivity(request, guard.user.id, 'create_custom_style')
  return NextResponse.json({ success: true, data: row })
}
