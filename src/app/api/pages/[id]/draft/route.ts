import { getCurrentUser } from '@/server/auth'
import { renderMarkdown } from '@/server/lib/markdown'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { saveDraft, getDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const draft = await getDraft('page', pageId)
  return NextResponse.json({
    success: true,
    data: draft
      ? {
          ...draft,
          metadata: parsePageDraftMetadata(draft.metadata),
        }
      : null,
  })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: pageId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  let { contentRaw, contentHtml } = body
  const ct = body.contentType || 'richtext'

  // 根据内容类型处理
  if (ct === 'markdown' && contentRaw) {
    contentHtml = await renderMarkdown(contentRaw)
  } else if (contentRaw && !contentHtml) {
    contentHtml = contentRaw
  }

  const result = await saveDraft(
    'page',
    pageId,
    {
      title: body.title || '',
      excerpt: '',
      contentType: ct,
      contentRaw: contentRaw || '',
      contentHtml: contentHtml || '',
      contentText: body.contentText || '',
      metadata: parsePageDraftMetadata(body.metadata),
    },
    user.id,
  )

  return NextResponse.json({ success: true, data: result })
}
