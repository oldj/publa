import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { safeParseJson } from '@/server/lib/request'
import { MAX_ENTRY_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import {
  createCustomStyle,
  listCustomStyles,
  reorderCustomStyles,
} from '@/server/services/custom-styles'
import { NextRequest } from 'next/server'

export async function GET() {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const rows = await listCustomStyles()
  return jsonSuccess(rows)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  if (body.action === 'reorder') {
    if (!Array.isArray(body.ids)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.customStyles',
        key: 'invalidReorder',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }

    try {
      await reorderCustomStyles(body.ids)
      return jsonSuccess()
    } catch {
      return jsonError({
        source: request,
        namespace: 'admin.api.customStyles',
        key: 'invalidReorder',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
  }

  const { name, css } = body
  if (!name || typeof name !== 'string') {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'nameRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  // 单条 CSS 文本上限与 zip 条目上限保持一致
  if (typeof css === 'string' && css.length > MAX_ENTRY_BYTES) {
    return jsonError({
      source: request,
      namespace: 'admin.api.customStyles',
      key: 'cssTooLarge',
      code: 'CSS_TOO_LARGE',
      status: 413,
    })
  }

  const row = await createCustomStyle({ name, css: typeof css === 'string' ? css : '' })
  await logActivity(request, guard.user.id, 'create_custom_style')
  return jsonSuccess(row)
}
