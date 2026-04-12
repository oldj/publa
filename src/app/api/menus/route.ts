import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { createMenu, listMenus, reorderMenus, resetMenus } from '@/server/services/menus'
import { NextRequest } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const menuList = await listMenus()
  return jsonSuccess(menuList)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 批量排序
  if (body.action === 'reorder' && Array.isArray(body.items)) {
    await reorderMenus(body.items)
    return jsonSuccess()
  }

  // 恢复默认
  if (body.action === 'reset') {
    await resetMenus()
    return jsonSuccess()
  }

  if (!body.title) {
    return jsonError({
      source: request,
      namespace: 'admin.api.menus',
      key: 'titleRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const menu = await createMenu(body)
  await logActivity(request, guard.user.id, 'create_menu')
  return jsonSuccess(menu)
}
