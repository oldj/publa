import { getCurrentUser } from '@/server/auth'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { listPublishedRevisions, deleteRevisions } from '@/server/services/revisions'
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const revisions = await listPublishedRevisions('post', postId)
  return NextResponse.json({ success: true, data: revisions })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { ids } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '请选择要删除的版本' },
      { status: 400 },
    )
  }

  const { id: idStr } = await params
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deleteRevisions('post', postId, ids)
  return NextResponse.json({ success: true })
}
