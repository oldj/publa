import { requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteMenu, updateMenu } from '@/server/services/menus'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: menuId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const menu = await updateMenu(menuId, body)
  await logActivity(request, guard.user.id, 'update_menu')
  return jsonSuccess(menu)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: menuId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteMenu(menuId)
  await logActivity(request, guard.user.id, 'delete_menu')
  return jsonSuccess()
}
