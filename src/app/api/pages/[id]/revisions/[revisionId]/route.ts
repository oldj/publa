import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam } from '@/server/lib/request'
import { getRevisionById } from '@/server/services/revisions'
import { NextRequest } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id, revisionId } = await params
  const { id: pageId, error: idError } = await parseIdParam(id)
  if (idError) return idError
  const { id: revId, error: revError } = await parseIdParam(revisionId)
  if (revError) return revError
  const revision = await getRevisionById(revId)

  if (!revision || revision.targetType !== 'page' || revision.targetId !== pageId) {
    return jsonError({
      namespace: 'admin.api.revisions',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  return jsonSuccess(revision)
}
