import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { renameAttachment, getAttachmentUrl } from '@/server/services/attachments'
import { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { newStorageKey } = body
  if (!newStorageKey || typeof newStorageKey !== 'string') {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'newStorageKeyRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  try {
    const updated = await renameAttachment(id, newStorageKey.trim())
    const publicUrl = await getAttachmentUrl(updated.storageKey)
    return jsonSuccess({ ...updated, publicUrl })
  } catch (_err: any) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'renameFailed',
      code: 'OPERATION_FAILED',
      status: 400,
    })
  }
}
