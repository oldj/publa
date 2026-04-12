import { requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { parseIdParam, parseIntParam } from '@/server/lib/request'
import { listUserActivityLogs } from '@/server/services/activity-logs'
import { getUserById } from '@/server/services/users'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'], {
    namespace: 'admin.api.users',
    key: 'forbidden',
  })
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: userId, error } = await parseIdParam(idStr)
  if (error) return error

  // admin 不能查看 owner 的活动日志
  if (guard.user.role === 'admin') {
    const target = await getUserById(userId)
    if (!target) {
      return jsonError({
        source: request,
        namespace: 'admin.api.users',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
    if (target.role === 'owner') {
      return jsonError({
        source: request,
        namespace: 'admin.api.users',
        key: 'forbidden',
        code: 'FORBIDDEN',
        status: 403,
      })
    }
  }

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 30, 1, 100)

  const data = await listUserActivityLogs({ userId, page, pageSize })
  return jsonSuccess(data)
}
