import { getCurrentUser } from '@/server/auth'
import { parseIntParam, parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import {
  deleteGuestbookMessage,
  getGuestbookMessageById,
  listGuestbookMessages,
  markGuestbookMessageRead,
  markGuestbookMessageUnread,
  markAllGuestbookMessagesRead,
} from '@/server/services/guestbook'
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

  // 单条详情
  const idStr = searchParams.get('id')
  if (idStr) {
    const { id: msgId, error: idError } = parseIdParam(idStr)
    if (idError) return idError
    const msg = await getGuestbookMessageById(msgId)
    if (!msg) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Message not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({ success: true, data: msg })
  }

  // 列表
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined

  const result = await listGuestbookMessages({ page, pageSize, status })
  return NextResponse.json({ success: true, data: result })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 全部标记为已读
  if (body.action === 'readAll') {
    await markAllGuestbookMessagesRead()
    logActivity(request, user.id, 'moderate_guestbook')
    return NextResponse.json({ success: true })
  }

  // 单条标记为已读/未读
  const { id, action } = body
  if (!id) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '缺少 ID' },
      { status: 400 },
    )
  }

  if (action === 'unread') {
    await markGuestbookMessageUnread(id)
  } else {
    await markGuestbookMessageRead(id)
  }
  logActivity(request, user.id, 'moderate_guestbook')
  return NextResponse.json({ success: true })
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
  const { id: msgId, error: idError } = parseIdParam(idStr)
  if (idError) return idError

  await deleteGuestbookMessage(msgId)
  logActivity(request, user.id, 'delete_guestbook')
  return NextResponse.json({ success: true })
}
