import { getCurrentUser } from '@/server/auth'
import { safeParseJson } from '@/server/lib/request'
import { renameAttachment, getAttachmentUrl } from '@/server/services/attachments'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '无效的 ID' },
      { status: 400 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { newStorageKey } = body
  if (!newStorageKey || typeof newStorageKey !== 'string') {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '缺少 newStorageKey' },
      { status: 400 },
    )
  }

  try {
    const updated = await renameAttachment(id, newStorageKey.trim())
    const publicUrl = await getAttachmentUrl(updated.storageKey)
    return NextResponse.json({ success: true, data: { ...updated, publicUrl } })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, code: 'OPERATION_FAILED', message: err.message || '重命名失败' },
      { status: 400 },
    )
  }
}
