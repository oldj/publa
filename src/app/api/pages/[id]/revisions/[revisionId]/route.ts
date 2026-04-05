import { getCurrentUser } from '@/server/auth'
import { parseIdParam } from '@/server/lib/request'
import { getRevisionById } from '@/server/services/revisions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id, revisionId } = await params
  const { id: pageId, error: idError } = parseIdParam(id)
  if (idError) return idError
  const { id: revId, error: revError } = parseIdParam(revisionId)
  if (revError) return revError
  const revision = await getRevisionById(revId)

  if (!revision || revision.targetType !== 'page' || revision.targetId !== pageId) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '版本不存在' },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: revision })
}
