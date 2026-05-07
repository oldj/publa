import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { isUniqueConstraintError, safeParseJson } from '@/server/lib/request'
import {
  createCategory,
  getCategoryBySlug,
  listCategories,
  reorderCategories,
} from '@/server/services/categories'
import { recountCategoriesAndTags } from '@/server/services/post-count'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const rows = await listCategories()
  return jsonSuccess(rows)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 批量排序
  if (body.action === 'reorder') {
    if (!Array.isArray(body.ids)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.categories',
        key: 'invalidReorder',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }

    try {
      await reorderCategories(body.ids)
      return jsonSuccess()
    } catch {
      return jsonError({
        source: request,
        namespace: 'admin.api.categories',
        key: 'invalidReorder',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
  }

  // 重新计数
  if (body.action === 'recount') {
    await recountCategoriesAndTags()
    await logActivity(request, guard.user.id, 'recount_categories')
    return jsonSuccess()
  }

  const { name, slug } = body

  if (!name || !slug) {
    return jsonError({
      source: request,
      namespace: 'admin.api.categories',
      key: 'nameAndSlugRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const existing = await getCategoryBySlug(slug)
  if (existing) {
    return jsonError({
      source: request,
      namespace: 'admin.api.categories',
      key: 'duplicateSlug',
      code: 'DUPLICATE_SLUG',
      status: 400,
    })
  }

  try {
    const category = await createCategory(body)
    await logActivity(request, guard.user.id, 'create_category')
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
