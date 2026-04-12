import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { MAX_ENTRY_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import { deleteCustomStyle, updateCustomStyle } from '@/server/services/custom-styles'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: styleId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 单条 CSS 文本上限与 zip 条目上限保持一致
  if (typeof body.css === 'string' && body.css.length > MAX_ENTRY_BYTES) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'cssTooLarge',
      code: 'CSS_TOO_LARGE',
      status: 413,
    })
  }

  const row = await updateCustomStyle(styleId, {
    ...(typeof body.name === 'string' && { name: body.name }),
    ...(typeof body.css === 'string' && { css: body.css }),
  })
  if (!row) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  await logActivity(request, guard.user.id, 'update_custom_style')
  return jsonSuccess(row)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: styleId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const result = await deleteCustomStyle(styleId)
  if (!result.success) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'notFound',
      code: result.code,
      status: 404,
    })
  }

  await logActivity(request, guard.user.id, 'delete_custom_style')
  return jsonSuccess()
}
