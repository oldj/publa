import { getCurrentUser } from '@/server/auth'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import { deleteCategory, getCategoryBySlug, updateCategory } from '@/server/services/categories'
import { logActivity } from '@/server/services/activity-logs'
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
  const { id: categoryId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 检查 slug 唯一性
  if (body.slug) {
    const existing = await getCategoryBySlug(body.slug)
    if (existing && existing.id !== categoryId) {
      return NextResponse.json(
        { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
        { status: 400 },
      )
    }
  }

  try {
    const category = await updateCategory(categoryId, body)
    if (!category) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '分类不存在' },
        { status: 404 },
      )
    }

    logActivity(request, user.id, 'update_category')
    return NextResponse.json({ success: true, data: category })
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
  const { id: categoryId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const result = await deleteCategory(categoryId)

  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'OPERATION_FAILED', message: result.message },
      { status: 400 },
    )
  }

  logActivity(request, user.id, 'delete_category')
  return NextResponse.json({ success: true })
}
