import { requireCurrentUser } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { parseIntParam } from '@/server/lib/request'
import { listComments } from '@/server/services/comments'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined
  const contentId = searchParams.get('contentId')
    ? parseIntParam(searchParams.get('contentId'), 0, 1)
    : undefined

  const result = await listComments({ page, pageSize, status, contentId })
  return jsonSuccess(result)
}
