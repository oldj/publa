import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { MAX_ENTRY_BYTES } from '@/server/lib/zip'
import { logActivity } from '@/server/services/activity-logs'
import {
  ActiveThemeError,
  BuiltinThemeError,
  deleteTheme,
  updateTheme,
} from '@/server/services/themes'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: themeId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 单条 CSS 文本上限与 zip 条目上限保持一致
  if (typeof body.css === 'string' && body.css.length > MAX_ENTRY_BYTES) {
    return jsonError({
      source: request,
      namespace: 'admin.api.themes',
      key: 'cssTooLarge',
      code: 'CSS_TOO_LARGE',
      status: 413,
    })
  }

  try {
    const theme = await updateTheme(themeId, {
      ...(typeof body.name === 'string' && { name: body.name }),
      ...(typeof body.css === 'string' && { css: body.css }),
    })
    if (!theme) {
      return jsonError({
        source: request,
        namespace: 'admin.api.themes',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
    await logActivity(request, guard.user.id, 'update_theme')
    return jsonSuccess(theme)
  } catch (err) {
    if (err instanceof BuiltinThemeError) {
      return jsonError({
        source: request,
        namespace: 'admin.api.themes',
        key: 'builtinTheme',
        code: 'BUILTIN_THEME',
        status: 400,
      })
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
  const { id: themeId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  try {
    const result = await deleteTheme(themeId)
    if (!result.success) {
      return jsonError({
        source: request,
        namespace: 'admin.api.themes',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
    await logActivity(request, guard.user.id, 'delete_theme')
    return jsonSuccess()
  } catch (err) {
    if (err instanceof BuiltinThemeError) {
      return jsonError({
        source: request,
        namespace: 'admin.api.themes',
        key: 'builtinTheme',
        code: 'BUILTIN_THEME',
        status: 400,
      })
    }
    if (err instanceof ActiveThemeError) {
      return jsonError({
        source: request,
        namespace: 'admin.api.themes',
        key: 'activeTheme',
        code: 'ACTIVE_THEME',
        status: 400,
      })
    }
    throw err
  }
}
