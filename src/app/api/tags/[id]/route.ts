import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteTag, getTagBySlug, updateTag } from '@/server/services/tags'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: tagId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  if (body.slug) {
    const existing = await getTagBySlug(body.slug)
    if (existing && existing.id !== tagId) {
      return jsonError({
        source: request,
        namespace: 'admin.api.tags',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
  }

  try {
    const tag = await updateTag(tagId, body)
    if (!tag) {
      return jsonError({
        source: request,
        namespace: 'admin.api.tags',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }

    await logActivity(request, guard.user.id, 'update_tag')
    return jsonSuccess(tag)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.tags',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
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
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: tagId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteTag(tagId)
  await logActivity(request, guard.user.id, 'delete_tag')
  return jsonSuccess()
}
