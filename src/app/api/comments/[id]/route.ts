import { getCurrentUser } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteComment, getCommentById, moderateComment } from '@/server/services/comments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: commentId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const comment = await getCommentById(commentId)
  if (!comment) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: 'Comment not found' },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: comment })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: commentId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { action } = body // 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_ACTION', message: '无效操作' },
      { status: 400 },
    )
  }

  await moderateComment(commentId, action, user.id)
  logActivity(request, user.id, 'moderate_comment')
  return NextResponse.json({ success: true })
}

export async function DELETE(
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
  const { id: commentId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deleteComment(commentId)
  logActivity(request, user.id, 'delete_comment')
  return NextResponse.json({ success: true })
}
