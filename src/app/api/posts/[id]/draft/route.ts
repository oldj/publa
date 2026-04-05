import { getCurrentUser } from '@/server/auth'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { saveDraft, getDraft, deleteDraft } from '@/server/services/revisions'
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const draft = await getDraft('post', postId)
  return NextResponse.json({ success: true, data: draft })
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
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  let { contentRaw, contentHtml, contentText } = body

  // 推导 contentType
  const ct = body.contentType || (body.isMarkdown ? 'markdown' : 'richtext')

  // 根据内容类型处理
  if (ct === 'markdown' && contentRaw) {
    contentHtml = await renderMarkdown(contentRaw)
    contentText = htmlToText(contentHtml)
  } else if (contentRaw && !contentHtml) {
    contentHtml = contentRaw
    if (!contentText) contentText = htmlToText(contentHtml)
  }

  const result = await saveDraft(
    'post',
    postId,
    {
      title: body.title || '',
      excerpt: body.excerpt || '',
      contentType: ct,
      contentRaw: contentRaw || '',
      contentHtml: contentHtml || '',
      contentText: contentText || '',
    },
    user.id,
  )

  return NextResponse.json({ success: true, data: result })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: idStr } = await params
  const { id: postId, error: idError } = parseIdParam(idStr)
  if (idError) return idError
  await deleteDraft('post', postId)
  return NextResponse.json({ success: true })
}
