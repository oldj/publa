import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { MAX_ENTRY_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import {
  BuiltinThemeError,
  createTheme,
  listThemes,
  reorderThemes,
} from '@/server/services/themes'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const rows = await listThemes()
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
      await reorderThemes(body.ids)
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

  // 单条 CSS 文本上限与 zip 条目上限保持一致，防止误操作写入超大 CSS
  if (typeof css === 'string' && css.length > MAX_ENTRY_BYTES) {
    return NextResponse.json(
      { success: false, code: 'CSS_TOO_LARGE', message: 'CSS 内容过大' },
      { status: 413 },
    )
  }

  try {
    const theme = await createTheme({ name, css: typeof css === 'string' ? css : '' })
    await logActivity(request, guard.user.id, 'create_theme')
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
