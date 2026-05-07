import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { isUniqueConstraintError, safeParseJson } from '@/server/lib/request'
import { recountCategoriesAndTags } from '@/server/services/post-count'
import { createTag, getTagBySlug, listTags } from '@/server/services/tags'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const rows = await listTags()
  return jsonSuccess(rows)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 重新计数
  if (body.action === 'recount') {
    await recountCategoriesAndTags()
    await logActivity(request, guard.user.id, 'recount_tags')
    return jsonSuccess()
  }

  const { name, slug } = body

  if (!name || !slug) {
    return jsonError({
      source: request,
      namespace: 'admin.api.tags',
      key: 'nameAndSlugRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const existing = await getTagBySlug(slug)
  if (existing) {
    return jsonError({
      source: request,
      namespace: 'admin.api.tags',
      key: 'duplicateSlug',
      code: 'DUPLICATE_SLUG',
      status: 400,
    })
  }

  try {
    const tag = await createTag(body)
    await logActivity(request, guard.user.id, 'create_tag')
    return jsonSuccess(tag)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.tags',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
    throw err
  }
}
