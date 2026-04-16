import { requireCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { htmlToText, renderMarkdown } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { isUniqueConstraintError, parseIntParam, safeParseJson } from '@/server/lib/request'
import {
  createEmptyPost,
  createPost,
  isSlugAvailable,
  listPostsAdmin,
  validateSlug,
} from '@/server/services/posts'
import { publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePostDraftMetadata } from '@/shared/revision-metadata'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

function getSlugValidationKey(code: 'REQUIRED' | 'STARTS_WITH_HYPHEN' | 'ENDS_WITH_HYPHEN') {
  if (code === 'REQUIRED') return 'slugRequired'
  if (code === 'STARTS_WITH_HYPHEN') return 'slugStartsWithHyphen'
  return 'slugEndsWithHyphen'
}

export async function GET(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = parseIntParam(searchParams.get('page'), 1, 1)
  const pageSize = parseIntParam(searchParams.get('pageSize'), 20, 1, 100)
  const status = searchParams.get('status') || undefined
  const categoryId = searchParams.get('categoryId')
    ? parseIntParam(searchParams.get('categoryId'), 0, 1)
    : undefined
  const tagId = searchParams.get('tagId')
    ? parseIntParam(searchParams.get('tagId'), 0, 1)
    : undefined
  const search = searchParams.get('search') || undefined

  const result = await listPostsAdmin({ page, pageSize, status, categoryId, tagId, search })
  return jsonSuccess(result)
}

export async function POST(request: NextRequest) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 创建空草稿（首次自动保存时调用）
  if (body.createEmpty) {
    const post = await createEmptyPost(guard.user.id)
    return jsonSuccess(post)
  }

  if (!body.title || !body.slug) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'titleAndSlugRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  // 定时发布必须提供发布时间
  if (body.status === 'scheduled' && !body.publishedAt) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'publishedAtRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const slugCheck = validateSlug(body.slug)
  if (!slugCheck.valid) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: getSlugValidationKey(slugCheck.code),
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const slugOk = await isSlugAvailable(body.slug)
  if (!slugOk) {
    return jsonError({
      source: request,
      namespace: 'admin.api.posts',
      key: 'duplicateSlug',
      code: 'DUPLICATE_SLUG',
      status: 400,
    })
  }

  // 推导并持久化 contentType
  const ct = body.contentType || (body.isMarkdown ? 'markdown' : 'richtext')
  body.contentType = ct

  // 根据内容类型处理（contentRaw !== undefined 表示字段显式提交，包括空串清空场景）
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
    const post = await createPost({ ...body, authorId: guard.user.id })

    // 首次发布时冻结一份历史版本，与 PUT 链路对齐
    if (body.status === 'published' || body.status === 'scheduled') {
      await db.transaction(async (tx) => {
        await saveDraft(
          'post',
          post.id,
          {
            title: body.title || '',
            excerpt: body.excerpt || '',
            contentType: body.contentType,
            contentRaw: body.contentRaw || '',
            contentHtml: body.contentHtml || '',
            contentText: body.contentText || '',
            metadata: parsePostDraftMetadata({
              slug: body.slug,
              categoryId: body.categoryId,
              tagNames: body.tagNames,
              coverImage: body.coverImage,
              seoTitle: body.seoTitle,
              seoDescription: body.seoDescription,
              publishedAt: post.publishedAt,
            }),
          },
          guard.user.id,
          tx,
        )
        await publishDraft('post', post.id, guard.user.id, tx)
      })
    }

    await logActivity(request, guard.user.id, 'create_post')

    return jsonSuccess(post)
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError({
        source: request,
        namespace: 'admin.api.posts',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
    throw err
  }
}
