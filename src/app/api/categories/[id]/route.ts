import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import { deleteCategory, getCategoryBySlug, updateCategory } from '@/server/services/categories'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: categoryId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 检查 slug 唯一性
  if (body.slug) {
    const existing = await getCategoryBySlug(body.slug)
    if (existing && existing.id !== categoryId) {
      return jsonError({
        source: request,
        namespace: 'admin.api.categories',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
  }

  try {
    const category = await updateCategory(categoryId, body)
    if (!category) {
      return jsonError({
        source: request,
        namespace: 'admin.api.categories',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }

    await logActivity(request, guard.user.id, 'update_category')
    return jsonSuccess(category)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.categories',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
    throw err
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: categoryId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const result = await deleteCategory(categoryId)

  if (!result.success) {
    return jsonError({
      source: request,
      namespace: 'admin.api.categories',
      key: 'referencedPosts',
      values: { count: result.count },
      code: 'CATEGORY_HAS_POSTS',
      status: 400,
    })
  }

  await logActivity(request, guard.user.id, 'delete_category')
  return jsonSuccess()
}
