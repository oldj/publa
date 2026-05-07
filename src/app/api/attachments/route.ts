import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, parseIntParam } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  uploadAttachment,
} from '@/server/services/attachments'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const mimeType = searchParams.get('mimeType') || undefined

  const result = await listAttachments({ page, mimeTypePrefix: mimeType })
  return jsonSuccess(result)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'fileRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const attachment = await uploadAttachment({
      file: buffer,
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: guard.user.id,
    })
    const publicUrl = await getAttachmentUrl(attachment.storageKey)
    await logActivity(request, guard.user.id, 'upload_attachment')
    return jsonSuccess({ ...attachment, publicUrl })
  } catch (_err: any) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'uploadFailed',
      code: 'UPLOAD_FAILED',
      status: 400,
    })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const idStr = searchParams.get('id')
  if (!idStr) {
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key: 'idRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }
  const { id: attachmentId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const result = await deleteAttachment(attachmentId)
  if (!result.success) {
    const key = result.code === 'NOT_FOUND' ? 'notFound' : 'deleteFailed'
    const status = result.code === 'NOT_FOUND' ? 404 : 400
    return jsonError({
      source: request,
      namespace: 'admin.api.attachments',
      key,
      code: result.code,
      status,
    })
  }
  await logActivity(request, guard.user.id, 'delete_attachment')
  return jsonSuccess()
}
