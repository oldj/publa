import { COMMENT_MAX_LENGTH } from '@/lib/constants'
import { getCurrentUser } from '@/server/auth'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { verifyCaptcha } from '@/server/lib/captcha'
import { acquireSubmissionSlot } from '@/server/lib/rate-limit'
import { safeParseJson } from '@/server/lib/request'
import { getRequestInfo } from '@/server/lib/request-info'
import { createComment, getCommentContentAccess } from '@/server/services/comments'
import { notifyNewComment } from '@/server/services/notifications'
import { getFrontendComments } from '@/server/services/posts-frontend'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

/** 获取文章评论 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.comments',
      key: 'slugRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  const access = await getCommentContentAccess({ slug })
  if (!access) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  if (!access.isPublic) {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError({
        source: request,
        namespace: 'frontend.api.posts',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
  }

  const commentList = await getFrontendComments(access.content.slug!)
  return jsonSuccess(commentList)
}

/** 提交评论 */
export async function POST(request: NextRequest) {
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { contentId, parentId, username, email, url, content, captchaCode } = body

  if (!content || !username) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.comments',
      key: 'contentAndUsernameRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return jsonError({
      source: request,
      namespace: 'frontend.commentForm.errors',
      key: 'contentTooLong',
      values: { max: COMMENT_MAX_LENGTH },
      code: 'CONTENT_TOO_LONG',
      status: 400,
    })
  }

  const access = await getCommentContentAccess({ contentId, slug: body.slug })
  if (!access) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.posts',
      key: 'notFound',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  let user = null
  if (!access.isPublic) {
    user = await getCurrentUser()
    if (!user) {
      return jsonError({
        source: request,
        namespace: 'frontend.api.posts',
        key: 'notFound',
        code: 'NOT_FOUND',
        status: 404,
      })
    }
  }

  // 验证验证码
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('captcha_session')?.value
  if (!sessionId || !captchaCode || !(await verifyCaptcha(sessionId, captchaCode))) {
    return jsonError({
      source: request,
      namespace: 'frontend.commentForm.errors',
      key: 'invalidCaptcha',
      code: 'INVALID_CAPTCHA',
      status: 400,
    })
  }

  const { ip, ua } = getRequestInfo(request)

  // 原子地检查并占位，防止并发穿透
  if (!(await acquireSubmissionSlot('comment', sessionId, ip))) {
    return jsonError({
      source: request,
      namespace: 'frontend.commentForm.errors',
      key: 'rateLimited',
      code: 'RATE_LIMITED',
      status: 429,
    })
  }

  const result = await createComment({
    contentId: access.content.id,
    parentId: Number(parentId) > 0 ? Number(parentId) : null,
    authorName: username,
    authorEmail: email || undefined,
    authorWebsite: url || undefined,
    content,
    ipAddress: ip,
    userAgent: ua,
    userId: user?.id || null,
  })

  if (!result.success) {
    const key =
      result.code === 'COMMENT_DISABLED'
        ? 'commentDisabled'
        : result.code === 'INVALID_PARENT'
          ? 'invalidParent'
          : 'nestedReplyNotAllowed'

    return jsonError({
      source: request,
      namespace: 'frontend.commentForm.errors',
      key,
      code: result.code,
      status: 400,
    })
  }

  void notifyNewComment({
    authorName: username,
    content,
    contentId: access.content.id,
  }).catch(() => {})

  return jsonSuccess(result.data)
}
