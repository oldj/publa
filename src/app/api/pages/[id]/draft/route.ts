import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { getPageById } from '@/server/services/pages'
import { saveDraft, getDraft, deleteDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { NextRequest } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const draft = await getDraft('page', pageId)
  return jsonSuccess(
    draft
      ? {
          ...draft,
          metadata: parsePageDraftMetadata(draft.metadata),
        }
      : null,
  )
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const page = await getPageById(pageId)
  if (!page) {
    return jsonError({
      source: request,
      namespace: 'admin.api.pages',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  let { contentRaw, contentHtml, contentText } = body
  const ct = body.contentType || 'richtext'

  // 根据内容类型处理（contentRaw !== undefined 表示字段显式提交，包括空串清空场景）
  if (contentRaw !== undefined) {
    if (ct === 'markdown') {
      contentHtml = await renderMarkdown(contentRaw || '')
      contentText = htmlToText(contentHtml)
    } else {
      contentHtml = sanitizeRichTextHtml(contentHtml || contentRaw)
      if (!contentText) contentText = htmlToText(contentHtml)
    }
  } else if (contentHtml) {
    // 只传 contentHtml 不传 contentRaw 时同样要过白名单，避免绕过
    contentHtml = sanitizeRichTextHtml(contentHtml)
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
    guard.user.id,
  )

  return jsonSuccess(result)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteDraft('page', pageId)
  return jsonSuccess()
}
