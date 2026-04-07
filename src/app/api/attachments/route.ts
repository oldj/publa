import { getCurrentUser } from '@/server/auth'
import { parseIdParam, parseIntParam } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  deleteAttachment,
  getAttachmentUrl,
  listAttachments,
  uploadAttachment,
} from '@/server/services/attachments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)

  const result = await listAttachments({ page })
  return NextResponse.json({ success: true, data: result })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '请选择文件' },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const attachment = await uploadAttachment({
      file: buffer,
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedBy: user.id,
    })
    const publicUrl = await getAttachmentUrl(attachment.storageKey)
    await logActivity(request, user.id, 'upload_attachment')
    return NextResponse.json({ success: true, data: { ...attachment, publicUrl } })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'UPLOAD_FAILED', message: err.message || '上传失败' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const idStr = searchParams.get('id')
  if (!idStr) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '缺少 ID' },
      { status: 400 },
    )
  }
  const { id: attachmentId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  const result = await deleteAttachment(attachmentId)
  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'OPERATION_FAILED', message: result.message },
      { status: 400 },
    )
  }
  await logActivity(request, user.id, 'delete_attachment')
  return NextResponse.json({ success: true })
}
