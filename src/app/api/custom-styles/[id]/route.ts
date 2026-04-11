import { requireRole } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteCustomStyle, updateCustomStyle } from '@/server/services/custom-styles'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: styleId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  const row = await updateCustomStyle(styleId, {
    ...(typeof body.name === 'string' && { name: body.name }),
    ...(typeof body.css === 'string' && { css: body.css }),
  })
  if (!row) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '自定义 CSS 不存在' },
      { status: 404 },
    )
  }

  await logActivity(request, guard.user.id, 'update_custom_style')
  return NextResponse.json({ success: true, data: row })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: styleId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const result = await deleteCustomStyle(styleId)
  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: result.message },
      { status: 404 },
    )
  }

  await logActivity(request, guard.user.id, 'delete_custom_style')
  return NextResponse.json({ success: true })
}
