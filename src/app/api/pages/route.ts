import { requireCurrentUser, requireRole } from '@/server/auth'
import { db } from '@/server/db'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { renderMarkdown, htmlToText } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { isUniqueConstraintError, parseIntParam, safeParseJson } from '@/server/lib/request'
import {
  createEmptyPage,
  createPage,
  isPagePathAvailable,
  listPages,
  validatePagePath,
} from '@/server/services/pages'
import { publishDraft, saveDraft } from '@/server/services/revisions'
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

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 50, 1, 100)
  const status = searchParams.get('status') || undefined
  const search = searchParams.get('search') || undefined

  const result = await listPages({ page, pageSize, status, search })
  return jsonSuccess(result)
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['owner', 'admin', 'editor'])
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 创建空草稿（首次自动保存时调用）
  if (body.createEmpty) {
    const page = await createEmptyPage()
    return jsonSuccess(page)
  }

  if (!body.title || !body.path) {
    return jsonError({
      source: request,
      namespace: 'admin.api.pages',
      key: 'titleAndPathRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
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

  const pathAvailable = await isPagePathAvailable(body.path)
  if (!pathAvailable) {
    return jsonError({
      source: request,
      namespace: 'admin.api.pages',
      key: 'duplicatePath',
      code: 'DUPLICATE_PATH',
      status: 400,
    })
  }

  // 根据内容类型处理（contentRaw !== undefined 表示字段显式提交，包括空串清空场景）
  const ct = body.contentType || 'richtext'
  body.contentType = ct
  if (body.contentRaw !== undefined) {
    if (ct === 'markdown') {
      body.contentHtml = await renderMarkdown(body.contentRaw || '')
      body.contentText = htmlToText(body.contentHtml)
    } else {
      body.contentHtml = sanitizeRichTextHtml(body.contentHtml || body.contentRaw)
      body.contentText = body.contentText || htmlToText(body.contentHtml)
    }
  } else if (body.contentHtml) {
    // 只传 contentHtml 不传 contentRaw 时同样要过白名单，避免绕过
    body.contentHtml = sanitizeRichTextHtml(body.contentHtml)
    body.contentText = body.contentText || htmlToText(body.contentHtml)
  }

  try {
    const page = await createPage(body)

    // 首次发布时冻结一份历史版本，与 PUT 链路对齐
    if (body.status === 'published' || body.status === 'scheduled') {
      await db.transaction(async (tx) => {
        await saveDraft(
          'page',
          page.id,
          {
            title: body.title || '',
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
              publishedAt: page.publishedAt,
            }),
          },
          guard.user.id,
          tx,
        )
        await publishDraft('page', page.id, guard.user.id, tx)
      })
    }

    await logActivity(request, guard.user.id, 'create_page')

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
