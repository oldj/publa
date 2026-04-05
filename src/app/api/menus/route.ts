import { requireRole } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { createMenu, listMenus, reorderMenus, resetMenus } from '@/server/services/menus'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const menuList = await listMenus()
  return NextResponse.json({ success: true, data: menuList })
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 批量排序
  if (body.action === 'reorder' && Array.isArray(body.items)) {
    await reorderMenus(body.items)
    return NextResponse.json({ success: true })
  }

  // 恢复默认
  if (body.action === 'reset') {
    await resetMenus()
    return NextResponse.json({ success: true })
  }

  if (!body.title) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '标题不能为空' },
      { status: 400 },
    )
  }

  const menu = await createMenu(body)
  return NextResponse.json({ success: true, data: menu })
}
