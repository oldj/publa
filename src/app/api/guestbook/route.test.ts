import { GUESTBOOK_MAX_LENGTH } from '@/lib/constants'
import * as schema from '@/server/db/schema'
import { settings } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockVerifyCaptcha, mockCookies } = vi.hoisted(() => ({
  mockVerifyCaptcha: vi.fn(),
  mockCookies: vi.fn(),
}))

vi.mock('@/server/lib/captcha', () => ({
  verifyCaptcha: mockVerifyCaptcha,
}))

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

vi.mock('@/server/services/notifications', () => ({
  notifyNewGuestbook: vi.fn().mockResolvedValue(undefined),
}))

const { POST } = await import('./route')

beforeEach(async () => {
  await setupTestDb()
  mockVerifyCaptcha.mockReset()
  mockCookies.mockReset()

  mockVerifyCaptcha.mockResolvedValue(true)
  mockCookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'captcha-session' }),
  })
})

describe('/api/guestbook POST', () => {
  it('正常提交留言', async () => {
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: '你好，这是一条留言',
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)

    const messages = await testDb.select().from(schema.guestbookMessages)
    expect(messages).toHaveLength(1)
    expect(messages[0].authorName).toBe('访客')
  })

  it('留言内容超过最大长度时返回 CONTENT_TOO_LONG', async () => {
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: 'a'.repeat(GUESTBOOK_MAX_LENGTH + 1),
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('CONTENT_TOO_LONG')
  })

  it('留言内容恰好等于最大长度时可以提交', async () => {
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: 'a'.repeat(GUESTBOOK_MAX_LENGTH),
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('30 秒内重复提交留言返回 RATE_LIMITED', async () => {
    // 第一次提交
    const first = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: '第一条留言',
          captchaCode: '1234',
        }),
      }) as any,
    )
    expect((await first.json()).success).toBe(true)

    mockVerifyCaptcha.mockResolvedValue(true)

    // 第二次提交应被限制
    const second = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: '第二条留言',
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await second.json()

    expect(second.status).toBe(429)
    expect(json.code).toBe('RATE_LIMITED')
    // 回归保护：失败响应需带 meta.captchaShouldRefresh，前端据此自动刷新
    expect(json.meta?.captchaShouldRefresh).toBe(true)
  })

  it('用户名和内容为空时返回校验错误', async () => {
    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '',
          content: '',
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('留言板关闭时返回 NOT_FOUND', async () => {
    await testDb.insert(settings).values({ key: 'enableGuestbook', value: 'false' })

    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: '测试留言',
          captchaCode: '1234',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })

  it('验证码错误时返回 INVALID_CAPTCHA', async () => {
    mockVerifyCaptcha.mockResolvedValue(false)

    const response = await POST(
      new Request('http://localhost/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '访客',
          content: '测试留言',
          captchaCode: 'wrong',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('INVALID_CAPTCHA')
    // 回归保护：失败响应需带 meta.captchaShouldRefresh，前端据此自动刷新
    expect(json.meta?.captchaShouldRefresh).toBe(true)
  })
})
