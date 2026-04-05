import { getCurrentUser } from '@/server/auth'
import { parseIdParam } from '@/server/lib/request'
import { updatePage } from '@/server/services/pages'
import { restoreRevision } from '@/server/services/revisions'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
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

  const result = await restoreRevision('page', pageId, revId, user.id)
  if (!result) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '版本不存在' },
      { status: 404 },
    )
  }

  // 将恢复的内容同步到页面主表
  await updatePage(pageId, {
    title: result.content.title,
    contentRaw: result.content.contentRaw,
    contentHtml: result.content.contentHtml,
    status: 'published',
  })

  return NextResponse.json({ success: true })
}
