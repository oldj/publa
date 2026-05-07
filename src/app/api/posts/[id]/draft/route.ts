import { requireCurrentUser, requireRole } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { parseIdParam, safeParseJson } from '@/server/lib/request'
import { getPostById } from '@/server/services/posts'
import { saveDraft, getDraft, deleteDraft } from '@/server/services/revisions'
import { parsePostDraftMetadata } from '@/shared/revision-metadata'
import { NextRequest } from 'next/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const draft = await getDraft('post', postId)
  return jsonSuccess(
    draft
      ? {
          ...draft,
          metadata: parsePostDraftMetadata(draft.metadata),
        }
      : null,
  )
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError

  const post = await getPostById(postId)
  if (!post) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  let { contentRaw, contentHtml, contentText } = body

  // 推导 contentType
  const ct = body.contentType || (body.isMarkdown ? 'markdown' : 'richtext')

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
    'post',
    postId,
    {
      title: body.title || '',
      excerpt: body.excerpt || '',
      contentType: ct,
      contentRaw: contentRaw || '',
      contentHtml: contentHtml || '',
      contentText: contentText || '',
      metadata: parsePostDraftMetadata(body.metadata),
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
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deleteDraft('post', postId)
  return jsonSuccess()
}
