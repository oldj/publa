import { requireCurrentUser } from '@/server/auth'
import { db } from '@/server/db'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { htmlToText, renderMarkdown } from '@/server/lib/markdown'
import { sanitizeRichTextHtml } from '@/server/lib/sanitize-html-content'
import { isUniqueConstraintError, parseIdParam, safeParseJson } from '@/server/lib/request'
import {
  deletePost,
  getPostById,
  isSlugAvailable,
  updatePost,
  validateSlug,
} from '@/server/services/posts'
import { getDraft, publishDraft, saveDraft } from '@/server/services/revisions'
import { parsePostDraftMetadata } from '@/shared/revision-metadata'
import { logActivity } from '@/server/services/activity-logs'
import { NextRequest } from 'next/server'

function getSlugValidationKey(code: 'REQUIRED' | 'STARTS_WITH_HYPHEN' | 'ENDS_WITH_HYPHEN') {
  if (code === 'REQUIRED') return 'slugRequired'
  if (code === 'STARTS_WITH_HYPHEN') return 'slugStartsWithHyphen'
  return 'slugEndsWithHyphen'
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const post = await getPostById(postId)
  if (!post) {
    return jsonError({
      namespace: 'admin.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  // 附带草稿内容（如果有）
  const draft = await getDraft('post', post.id)
  return jsonSuccess({
    ...post,
    draftContent: draft
      ? {
          ...parsePostDraftMetadata(draft.metadata),
          title: draft.title,
          excerpt: draft.excerpt,
          contentType: draft.contentType,
          contentRaw: draft.contentRaw,
          contentHtml: draft.contentHtml,
          contentText: draft.contentText,
          updatedAt: draft.updatedAt,
        }
      : null,
  })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  const { data: body, error } = await safeParseJson(request)
  if (error) return error

  // 发布/定时发布时校验必填字段
  if (body.status === 'published' || body.status === 'scheduled') {
    if (!body.title) {
      return jsonError({
        source: request,
        namespace: 'admin.api.posts',
        key: 'publishTitleRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
    if (!body.slug) {
      return jsonError({
        source: request,
        namespace: 'admin.api.posts',
        key: 'publishSlugRequired',
        code: 'VALIDATION_ERROR',
        status: 400,
      })
    }
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

  if (body.slug) {
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

    const slugOk = await isSlugAvailable(body.slug, postId)
    if (!slugOk) {
      return jsonError({
        source: request,
        namespace: 'admin.api.posts',
        key: 'duplicateSlug',
        code: 'DUPLICATE_SLUG',
        status: 400,
      })
    }
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
    if (body.status === 'published' || body.status === 'scheduled') {
      // 发布/定时发布时将主表更新和版本冻结包进事务
      const post = await db.transaction(async (tx) => {
        const result = await updatePost(postId, body, tx)
        if (!result) return null

        await saveDraft(
          'post',
          postId,
          {
            title: body.title || result.title || '',
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
              publishedAt: result.publishedAt,
            }),
          },
          guard.user.id,
          tx,
        )
        await publishDraft('post', postId, guard.user.id, tx)

        return result
      })

      if (!post) {
        return jsonError({
          source: request,
          namespace: 'admin.api.posts',
          key: 'notFound',
          code: 'NOT_FOUND',
          status: 404,
        })
      }
      await logActivity(request, guard.user.id, 'update_post')

      return jsonSuccess(post)
    }

    // 非发布操作，直接更新主表
    const post = await updatePost(postId, body)
    if (!post) {
      return jsonError({
        source: request,
        namespace: 'admin.api.posts',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }

    await logActivity(request, guard.user.id, 'update_post')

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCurrentUser()
  if (!guard.ok) return guard.response

  const { id: idStr } = await params
  const { id: postId, error: idError } = await parseIdParam(idStr)
  if (idError) return idError
  await deletePost(postId)

  await logActivity(request, guard.user.id, 'delete_post')

  return jsonSuccess()
}
