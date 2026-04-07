import { requireRole } from '@/server/auth'
import { parseIdParam, parseIntParam } from '@/server/lib/request'
import { listUserActivityLogs } from '@/server/services/activity-logs'
import { getUserById } from '@/server/services/users'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: userId, error } = parseIdParam(idStr)
  if (error) return error

  // admin 不能查看 owner 的活动日志
  if (guard.user.role === 'admin') {
    const target = await getUserById(userId)
    if (!target) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '用户不存在' },
        { status: 404 },
      )
    }
    if (target.role === 'owner') {
      return NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: '权限不足' },
        { status: 403 },
      )
    }
  }

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 30, 1, 100)

  const data = await listUserActivityLogs({ userId, page, pageSize })
  return NextResponse.json({ success: true, data })
}
