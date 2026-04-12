import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
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
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)

  // 单条详情
  const idStr = searchParams.get('id')
  if (idStr) {
    const { id: msgId, error: idError } = await parseIdParam(idStr)
    if (idError) return idError
    const msg = await getGuestbookMessageById(msgId)
    if (!msg) {
      return jsonError({
        source: request,
        namespace: 'admin.api.guestbook',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
    return jsonSuccess(msg)
  }

  // 列表
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined

  const result = await listGuestbookMessages({ page, pageSize, status })
  return jsonSuccess(result)
}

export async function PUT(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 全部标记为已读
  if (body.action === 'readAll') {
    await markAllGuestbookMessagesRead()
    await logActivity(request, guard.user.id, 'moderate_guestbook')
    return jsonSuccess()
  }

  // 单条标记为已读/未读
  const { id, action } = body
  if (!id) {
    return jsonError({
      source: request,
      namespace: 'admin.api.guestbook',
      key: 'idRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (action === 'unread') {
    await markGuestbookMessageUnread(id)
  } else {
    await markGuestbookMessageRead(id)
  }
  await logActivity(request, guard.user.id, 'moderate_guestbook')
  return jsonSuccess()
}

export async function DELETE(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const idStr = searchParams.get('id')
  if (!idStr) {
    return jsonError({
      source: request,
      namespace: 'admin.api.guestbook',
      key: 'idRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }
  const { id: msgId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  await deleteGuestbookMessage(msgId)
  await logActivity(request, guard.user.id, 'delete_guestbook')
  return jsonSuccess()
}
