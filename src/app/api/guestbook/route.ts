import { GUESTBOOK_MAX_LENGTH } from '@/lib/constants'
import { verifyCaptcha } from '@/server/lib/captcha'
import { acquireSubmissionSlot } from '@/server/lib/rate-limit'
import { safeParseJson } from '@/server/lib/request'
import { createGuestbookMessage } from '@/server/services/guestbook'
import { notifyNewGuestbook } from '@/server/services/notifications'
import { getSetting } from '@/server/services/settings'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const enableGuestbook = await getSetting('enableGuestbook')
  if (enableGuestbook === 'false') {
    return NextResponse.json(
      { success: false, code: 'NOT_FOUND', message: 'Guestbook is disabled' },
      { status: 404 },
    )
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  const { username, email, url, content, captchaCode } = body

  if (!content || !username) {
    return NextResponse.json(
      { success: false, code: 'VALIDATION_ERROR', message: '用户名和内容不能为空' },
      { status: 400 },
    )
  }

  if (content.length > GUESTBOOK_MAX_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        code: 'CONTENT_TOO_LONG',
        message: `留言内容不能超过 ${GUESTBOOK_MAX_LENGTH} 字符`,
      },
      { status: 400 },
    )
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
  if (!(await acquireSubmissionSlot('guestbook', sessionId, ip))) {
    return NextResponse.json(
      { success: false, code: 'RATE_LIMITED', message: '提交过于频繁，请 30 秒后再试' },
      { status: 429 },
    )
  }

  const result = await createGuestbookMessage({
    authorName: username,
    authorEmail: email || undefined,
    authorWebsite: url || undefined,
    content,
    ipAddress: ip,
    userAgent: ua,
  })

  void notifyNewGuestbook({
    authorName: username,
    content,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: result.data })
}
