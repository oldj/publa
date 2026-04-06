import { requireRole } from '@/server/auth'
import { parseIdParam, parseIntParam } from '@/server/lib/request'
import { listUserActivityLogs } from '@/server/services/activity-logs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: userId, error } = parseIdParam(idStr)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 30, 1, 100)

  const data = await listUserActivityLogs({ userId, page, pageSize })
  return NextResponse.json({ success: true, data })
}
