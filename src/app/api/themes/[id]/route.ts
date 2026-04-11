import { requireRole } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { BuiltinThemeError, deleteTheme, updateTheme } from '@/server/services/themes'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: themeId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  try {
    const theme = await updateTheme(themeId, {
      ...(typeof body.name === 'string' && { name: body.name }),
      ...(typeof body.css === 'string' && { css: body.css }),
    })
    if (!theme) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '主题不存在' },
        { status: 404 },
      )
    }
    await logActivity(request, guard.user.id, 'update_theme')
    return NextResponse.json({ success: true, data: theme })
  } catch (err) {
    if (err instanceof BuiltinThemeError) {
      return NextResponse.json(
        { success: false, code: 'BUILTIN_THEME', message: err.message },
        { status: 400 },
      )
    }
    throw err
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: themeId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  try {
    const result = await deleteTheme(themeId)
    if (!result.success) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: result.message },
        { status: 404 },
      )
    }
    await logActivity(request, guard.user.id, 'delete_theme')
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof BuiltinThemeError) {
      return NextResponse.json(
        { success: false, code: 'BUILTIN_THEME', message: err.message },
        { status: 400 },
      )
    }
    throw err
  }
}
