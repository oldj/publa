import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteComment, getCommentById, moderateComment } from '@/server/services/comments'
import { NextRequest } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: commentId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const comment = await getCommentById(commentId)
  if (!comment) {
    return jsonError({
      namespace: 'common.errors',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  return jsonSuccess(comment)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: commentId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { action } = body // 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(action)) {
    return jsonError({
      source: request,
      namespace: 'admin.api.comments',
      key: 'invalidAction',
      code: 'INVALID_ACTION',
      status: 400,
    })
  }

  await moderateComment(commentId, action, guard.user.id)
  await logActivity(request, guard.user.id, 'moderate_comment')
  return jsonSuccess()
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: commentId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteComment(commentId)
  await logActivity(request, guard.user.id, 'delete_comment')
  return jsonSuccess()
}
