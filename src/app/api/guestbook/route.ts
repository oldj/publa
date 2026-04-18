import { GUESTBOOK_MAX_LENGTH } from '@/lib/constants'
import { jsonError, jsonSuccess } from '@/server/lib/api-response'
import { verifyCaptcha } from '@/server/lib/captcha'
import { acquireSubmissionSlot } from '@/server/lib/rate-limit'
import { safeParseJson } from '@/server/lib/request'
import { getRequestInfo } from '@/server/lib/request-info'
import { createGuestbookMessage } from '@/server/services/guestbook'
import { notifyNewGuestbook } from '@/server/services/notifications'
import { getSetting, toBool } from '@/server/services/settings'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (!toBool(await getSetting('enableGuestbook'))) {
    return jsonError({
      source: request,
      namespace: 'frontend.guestbook',
      key: 'disabled',
      code: 'NOT_FOUND',
      status: 404,
    })
  }

  const { data: body, error } = await safeParseJson(request)
  if (error) return error
  // 两端空白视为空；既防御纯空白提交，又避免脏数据入库
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const captchaCode = typeof body.captchaCode === 'string' ? body.captchaCode : ''

  if (!content || !username) {
    return jsonError({
      source: request,
      namespace: 'frontend.api.guestbook',
      key: 'contentAndUsernameRequired',
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  }

  if (content.length > GUESTBOOK_MAX_LENGTH) {
    return jsonError({
      source: request,
      namespace: 'frontend.guestbook.form.errors',
      key: 'contentTooLong',
      values: { max: GUESTBOOK_MAX_LENGTH },
      code: 'CONTENT_TOO_LONG',
      status: 400,
    })
  }

  // 验证验证码
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('captcha_session')?.value
  if (!sessionId || !captchaCode || !(await verifyCaptcha(sessionId, captchaCode))) {
    return jsonError({
      source: request,
      namespace: 'frontend.guestbook.form.errors',
      key: 'invalidCaptcha',
      code: 'INVALID_CAPTCHA',
      status: 400,
    })
  }

  const { ip, ua } = getRequestInfo(request)

  // 原子地检查并占位，防止并发穿透
  if (!(await acquireSubmissionSlot('guestbook', sessionId, ip))) {
    return jsonError({
      source: request,
      namespace: 'frontend.guestbook.form.errors',
      key: 'rateLimited',
      code: 'RATE_LIMITED',
      status: 429,
    })
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

  return jsonSuccess(result.data)
}
