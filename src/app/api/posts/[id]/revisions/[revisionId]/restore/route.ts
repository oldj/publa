import { requireCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam } from '@/server/lib/request'
import { updatePost } from '@/server/services/posts'
import { buildPostRestoreInput } from '@/server/services/revision-restore'
import { restoreRevision } from '@/server/services/revisions'
import { ensureTagIdsByNames } from '@/server/services/tags'
import { parsePostDraftMetadata } from '@/shared/revision-metadata'
import { NextRequest } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id, revisionId } = await params
  const { id: postId, error: idError } = await parseIdParam(id)
  if (idError) return idError
  const { id: revId, error: revError } = await parseIdParam(revisionId)
  if (revError) return revError

  const result = await db.transaction(async (tx) => {
    const restored = await restoreRevision('post', postId, revId, guard.user.id, tx)
    if (!restored) return null

    const metadata = parsePostDraftMetadata(restored.content.metadata)
    const tagIds = await ensureTagIdsByNames(metadata.tagNames, tx)

    // 将恢复的内容同步到文章主表
    await updatePost(postId, buildPostRestoreInput(restored.content, tagIds), tx)

    return restored
  })

  if (!result) {
    return jsonError({
      namespace: 'admin.api.revisions',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  return jsonSuccess()
}
