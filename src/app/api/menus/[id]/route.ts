import { requireRole } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { deleteMenu, updateMenu } from '@/server/services/menus'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: menuId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const menu = await updateMenu(menuId, body)
  return NextResponse.json({ success: true, data: menu })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: menuId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deleteMenu(menuId)
  return NextResponse.json({ success: true })
}
