import { requireRole } from '@/server/auth'
import { jsonSuccess } from '@/server/lib/api-response'
import { parseIntParam } from '@/server/lib/request'
import { listActivityLogs } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)

  const data = await listActivityLogs({ page, pageSize })
  return jsonSuccess(data)
}
