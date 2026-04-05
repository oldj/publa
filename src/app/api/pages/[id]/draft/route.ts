import { getCurrentUser } from '@/server/auth'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { getPageById } from '@/server/services/pages'
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

  const page = await getPageById(pageId)
  if (!page) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '页面不存在' },
      { status: 404 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  let { contentRaw, contentHtml, contentText } = body
  const ct = body.contentType || 'richtext'

  // 根据内容类型处理
  if (ct === 'markdown' && contentRaw) {
    contentHtml = await renderMarkdown(contentRaw)
    contentText = htmlToText(contentHtml)
  } else if (contentRaw && !contentHtml) {
    contentHtml = contentRaw
    if (!contentText) contentText = htmlToText(contentHtml)
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
      contentText: contentText || '',
      metadata: parsePageDraftMetadata(body.metadata),
    },
    user.id,
  )

  return NextResponse.json({ success: true, data: result })
}
