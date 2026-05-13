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

const USERNAME_MAX_LENGTH = 64
const EMAIL_MAX_LENGTH = 254
const URL_MAX_LENGTH = 2048
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// 与项目通用返回类型对齐：{ success: true, data } | { success: false }
type ParsedOptionalInt = { success: true; data: number | null } | { success: false }

function parseOptionalPositiveInt(value: unknown): ParsedOptionalInt {
  if (value === undefined || value === null || value === '') return { success: true, data: null }
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(n) || n < 0) return { success: false }
  // 约定：0 被视作 null（例如 parentId="0" 表示顶级评论）
  return { success: true, data: n === 0 ? null : n }
}

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
  const rawUsername = toTrimmed(body.username)
  const rawEmail = toTrimmed(body.email)
  const rawUrl = toTrimmed(body.url)
  // 两端空白视为空；既防御纯空白提交，又避免脏数据入库
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const captchaCode = typeof body.captchaCode === 'string' ? body.captchaCode : ''

  if (!content || !rawUsername) {
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

  // 字段格式校验失败统一走这个 helper，避免下面一长串 jsonError 重复
  const invalidInput = () =>
    jsonError({
      source: request,
      namespace: 'frontend.api.comments',
      key: 'invalidInput',
      code: 'VALIDATION_ERROR',
      status: 400,
    })

  if (rawUsername.length > USERNAME_MAX_LENGTH) return invalidInput()
  if (rawEmail && (rawEmail.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(rawEmail))) {
    return invalidInput()
  }
  if (rawUrl && (rawUrl.length > URL_MAX_LENGTH || !isValidHttpUrl(rawUrl))) {
    return invalidInput()
  }

  const parentIdParsed = parseOptionalPositiveInt(body.parentId)
  if (!parentIdParsed.success) return invalidInput()

  const contentIdParsed = parseOptionalPositiveInt(body.contentId)
  if (!contentIdParsed.success) return invalidInput()

  const access = await getCommentContentAccess({
    contentId: contentIdParsed.data ?? undefined,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
  })
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

  // 注意：以下任何路径（包括 INVALID_CAPTCHA 短路场景）返回时，
  // captcha token 状态已不可用，jsonError 必须带 meta.captchaShouldRefresh: true
  // 让前端同步刷新。若未来调整流水线顺序，需同步检查此处与所有受影响的 jsonError 调用。
  //
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
      meta: { captchaShouldRefresh: true },
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
      meta: { captchaShouldRefresh: true },
    })
  }

  const result = await createComment({
    contentId: access.content.id,
    parentId: parentIdParsed.data,
    authorName: rawUsername,
    authorEmail: rawEmail || undefined,
    authorWebsite: rawUrl || undefined,
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
      meta: { captchaShouldRefresh: true },
    })
  }

  void notifyNewComment({
    authorName: rawUsername,
    content,
    contentId: access.content.id,
  }).catch(() => {})

  return jsonSuccess(result.data)
}
