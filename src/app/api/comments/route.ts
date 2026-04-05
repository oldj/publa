import { COMMENT_MAX_LENGTH } from '@/lib/constants'
import { getCurrentUser } from '@/server/auth'
import { verifyCaptcha } from '@/server/lib/captcha'
import { acquireSubmissionSlot } from '@/server/lib/rate-limit'
import { safeParseJson } from '@/server/lib/request'
import { createComment, getCommentContentAccess } from '@/server/services/comments'
import { notifyNewComment } from '@/server/services/notifications'
import { getFrontendComments } from '@/server/services/posts-frontend'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/** 获取文章评论 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: 'slug is required' },
      { status: 400 },
    )
  }

  const access = await getCommentContentAccess({ slug })
  if (!access) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '文章不存在' },
      { status: 404 },
    )
  }

  if (!access.isPublic) {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '文章不存在' },
        { status: 404 },
      )
    }
  }

  const commentList = await getFrontendComments(access.content.slug!)
  return NextResponse.json({ success: true, data: commentList })
}

/** 提交评论 */
export async function POST(request: NextRequest) {
  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { contentId, parentId, username, email, url, content, captchaCode } = body

  if (!content || !username) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '用户名和内容不能为空' },
      { status: 400 },
    )
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        code: 'CONTENT_TOO_LONG',
        message: `评论内容不能超过 ${COMMENT_MAX_LENGTH} 字符`,
      },
      { status: 400 },
    )
  }

  const access = await getCommentContentAccess({ contentId, slug: body.slug })
  if (!access) {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: '文章不存在' },
      { status: 404 },
    )
  }

  let user = null
  if (!access.isPublic) {
    user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: '文章不存在' },
        { status: 404 },
      )
    }
  }

  // 验证验证码
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('captcha_session')?.value
  if (!sessionId || !captchaCode || !(await verifyCaptcha(sessionId, captchaCode))) {
    return NextResponse.json(
      { success: false, code: 'INVALID_CAPTCHA', message: '验证码错误' },
      { status: 400 },
    )
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : request.headers.get('x-real-ip') || ''
  const ua = request.headers.get('user-agent') || ''

  // 原子地检查并占位，防止并发穿透
  if (!(await acquireSubmissionSlot('comment', sessionId, ip))) {
    return NextResponse.json(
      { success: false, code: 'RATE_LIMITED', message: '提交过于频繁，请 30 秒后再试' },
      { status: 429 },
    )
  }

  const result = await createComment({
    contentId: access.content.id,
    parentId: parentId || null,
    authorName: username,
    authorEmail: email || undefined,
    authorWebsite: url || undefined,
    content,
    ipAddress: ip,
    userAgent: ua,
    userId: user?.id || null,
  })

  if (!result.success) {
    return NextResponse.json(
      { success: false, code: 'OPERATION_FAILED', message: result.message },
      { status: 400 },
    )
  }

  void notifyNewComment({
    authorName: username,
    content,
    contentId: access.content.id,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: result.data })
}
