import { getCurrentUser } from '@/server/auth'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import { logActivity } from '@/server/services/activity-logs'
import { deleteTag, getTagBySlug, updateTag } from '@/server/services/tags'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: tagId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  if (body.slug) {
    const existing = await getTagBySlug(body.slug)
    if (existing && existing.id !== tagId) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
        { status: 400 },
      )
    }
  }

  try {
    const tag = await updateTag(tagId, body)
    if (!tag) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '标签不存在' },
        { status: 404 },
      )
    }

    logActivity(request, user.id, 'update_tag')
    return NextResponse.json({ success: true, data: tag })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
        { status: 400 },
      )
    }
    throw err
  }
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
  const { id: tagId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deleteTag(tagId)
  logActivity(request, user.id, 'delete_tag')
  return NextResponse.json({ success: true })
}
