import { requireCurrentUser } from '@/server/auth'
import { isUniqueConstraintError, safeParseJson } from '@/server/lib/request'
import { createCategory, getCategoryBySlug, listCategories } from '@/server/services/categories'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const rows = await listCategories()
  return NextResponse.json({ success: true, data: rows })
}

export async function POST(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { name, slug } = body

  if (!name || !slug) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '名称和 slug 不能为空' },
      { status: 400 },
    )
  }

  const existing = await getCategoryBySlug(slug)
  if (existing) {
    return NextResponse.json(
      { success: false, code: 'DUPLICATE_SLUG', message: 'slug 已存在' },
      { status: 400 },
    )
  }

  try {
    const category = await createCategory(body)
    logActivity(request, guard.user.id, 'create_category')
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
