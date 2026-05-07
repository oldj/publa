import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { listPublishedRevisions, deleteRevisions } from '@/server/services/revisions'
import { NextRequest } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const revisions = await listPublishedRevisions('page', pageId)
  return jsonSuccess(revisions)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return jsonError({
      source: request,
      namespace: 'admin.api.revisions',
      key: 'selectionRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteRevisions('page', pageId, ids)
  return jsonSuccess()
}
