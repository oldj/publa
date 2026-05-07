import { requireCurrentUser, requireRole } from '@/server/auth'
import { db } from '@/server/db'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import {
  deletePage,
  getPageById,
  isPagePathAvailable,
  updatePage,
  validatePagePath,
} from '@/server/services/pages'
import { getDraft, publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePageDraftMetadata } from '@/shared/revision-metadata'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

function getPathValidationKey(
  code:
    | 'REQUIRED'
    | 'ENDS_WITH_SLASH'
    | 'STARTS_WITH_SLASH'
    | 'STARTS_WITH_HYPHEN'
    | 'ENDS_WITH_HYPHEN'
    | 'RESERVED',
) {
  if (code === 'REQUIRED') return 'pathRequired'
  if (code === 'ENDS_WITH_SLASH') return 'pathEndsWithSlash'
  if (code === 'STARTS_WITH_SLASH') return 'pathStartsWithSlash'
  if (code === 'STARTS_WITH_HYPHEN') return 'pathStartsWithHyphen'
  if (code === 'ENDS_WITH_HYPHEN') return 'pathEndsWithHyphen'
  return 'pathReserved'
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const page = await getPageById(pageId)
  if (!page) {
    return jsonError({
      namespace: 'admin.api.pages',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  // 附带草稿内容（如果有）
  const draft = await getDraft('page', page.id)
  return jsonSuccess({
    ...page,
    draftContent: draft
      ? {
          ...parsePageDraftMetadata(draft.metadata),
          title: draft.title,
          contentType: draft.contentType,
          contentRaw: draft.contentRaw,
          contentHtml: draft.contentHtml,
          updatedAt: draft.updatedAt,
        }
      : null,
  })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 发布/定时发布时校验必填字段
  if (body.status === 'published' || body.status === 'scheduled') {
    if (!body.title) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: 'publishTitleRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
    if (!body.path) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: 'publishPathRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
  }

  // 定时发布必须提供发布时间
  if (body.status === 'scheduled' && !body.publishedAt) {
    return jsonError({
      source: request,
      namespace: 'admin.api.pages',
      key: 'publishedAtRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  // 校验路径（如果提供了路径）
  if (body.path) {
    const pathCheck = validatePagePath(body.path)
    if (!pathCheck.valid) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: getPathValidationKey(pathCheck.code),
        values: pathCheck.values,
        code: 'INVALID_PATH',
        status: 400,
      })
    }
    const pathAvailable = await isPagePathAvailable(body.path, pageId)
    if (!pathAvailable) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: 'duplicatePath',
        code: 'DUPLICATE_PATH',
        status: 400,
      })
    }
  }

  // 根据内容类型处理
  const ct = body.contentType || 'richtext'
  body.contentType = ct
  if (body.contentRaw !== undefined) {
    if (ct === 'markdown') {
      body.contentHtml = await renderMarkdown(body.contentRaw || '')
      body.contentText = htmlToText(body.contentHtml)
    } else {
      // richtext/html：内容作为 HTML 保存前需要经过白名单净化
      body.contentHtml = sanitizeRichTextHtml(body.contentHtml || body.contentRaw)
      body.contentText = body.contentText || htmlToText(body.contentHtml)
    }
  } else if (body.contentHtml) {
    // 只传 contentHtml 不传 contentRaw 时同样要过白名单，避免绕过
    body.contentHtml = sanitizeRichTextHtml(body.contentHtml)
    body.contentText = body.contentText || htmlToText(body.contentHtml)
  }

  try {
    if (body.status === 'published' || body.status === 'scheduled') {
      // 发布/定时发布时将主表更新和版本冻结包进事务
      const page = await db.transaction(async (tx) => {
        const result = await updatePage(pageId, body, tx)
        if (!result) return null

        await saveDraft(
          'page',
          pageId,
          {
            title: body.title || result.title || '',
            excerpt: '',
            contentType: body.contentType,
            contentRaw: body.contentRaw || '',
            contentHtml: body.contentHtml || '',
            contentText: body.contentText || '',
            metadata: parsePageDraftMetadata({
              path: body.path,
              template: body.template,
              mimeType: body.mimeType,
              seoTitle: body.seoTitle,
              seoDescription: body.seoDescription,
              publishedAt: result.publishedAt,
            }),
          },
          guard.user.id,
          tx,
        )
        await publishDraft('page', pageId, guard.user.id, tx)

        return result
      })

      if (!page) {
        return jsonError({
          source: request,
          namespace: 'admin.api.pages',
          key: 'notFound',
          code: 'NOT_FOUND',
          status: 404,
        })
      }
      await logActivity(request, guard.user.id, 'update_page')

      return jsonSuccess(page)
    }

    // 非发布操作，直接更新主表
    const page = await updatePage(pageId, body)
    if (!page) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }

    await logActivity(request, guard.user.id, 'update_page')

    return jsonSuccess(page)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.pages',
        key: 'duplicatePath',
        code: 'DUPLICATE_PATH',
        status: 400,
      })
    }
    throw err
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: pageId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deletePage(pageId)

  await logActivity(request, guard.user.id, 'delete_page')

  return jsonSuccess()
}
