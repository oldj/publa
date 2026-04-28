import { requireCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam } from '@/server/lib/request'
import { getPostDailyViews } from '@/server/services/content-views'
import { getPostById } from '@/server/services/posts'
import { NextRequest } from 'next/server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// 防止恶意拉取过大区间，超过 400 天即拒绝
const MAX_RANGE_DAYS = 400

function isValidDateString(s: string | null): s is string {
  if (!s || !DATE_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return false
  // JS Date 对像 2026-02-30 这种非法日历日会静默回滚为 2026-03-02，
  // round-trip 回字符串再比对可以拒掉这类输入。
  return d.toISOString().slice(0, 10) === s
}

function diffInDays(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  )
  return Math.round((b - a) / 86400000)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr, request)
  if (idError) return idError

  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'viewsRangeInvalid',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const days = diffInDays(from, to)
  if (days < 0 || days > MAX_RANGE_DAYS) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'viewsRangeInvalid',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const post = await getPostById(postId)
  if (!post) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  const items = await getPostDailyViews(postId, from, to)
  return jsonSuccess({ items })
}
