import { getCurrentUser } from '@/server/auth'
import { parseIntParam } from '@/server/lib/request'
import { listComments } from '@/server/services/comments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined
  const contentId = searchParams.get('contentId')
    ? parseIntParam(searchParams.get('contentId'), 0, 1)
    : undefined

  const result = await listComments({ page, pageSize, status, contentId })
  return NextResponse.json({ success: true, data: result })
}
