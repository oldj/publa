import { afterEach, describe, expect, it, vi } from 'vitest'

// mock jwt 校验，默认放行
const { mockJwtVerify, mockSign } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn().mockResolvedValue({ payload: {} }),
  mockSign: vi.fn().mockResolvedValue('renewed-token'),
}))

vi.mock('jose', () => {
  class MockSignJWT {
    setProtectedHeader() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    sign = mockSign
  }
  return { jwtVerify: mockJwtVerify, SignJWT: MockSignJWT }
})

vi.mock('@/server/auth/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/server/auth/shared')>()
  return {
    AUTH_COOKIE_NAME: '_token',
    TOKEN_MAX_AGE: 60 * 60 * 24 * 7,
    shouldRenewToken: original.shouldRenewToken,
    getJwtSecret: () => new TextEncoder().encode('test-secret'),
    isAuthConfigError: () => false,
  }
})

// 设置自定义后台路径，必须在 proxy.ts 被 import 之前
vi.stubEnv('ADMIN_PATH', 'backstage')

// 需要在环境变量设置后动态 import，以使模块顶层读到正确的 ADMIN_PATH
const { proxy } = await import('./proxy')

/** 构造 NextRequest（附带有效 cookie 以通过认证检查） */
function makeRequest(url: string) {
  const { NextRequest } = require('next/server')
  return new NextRequest(new URL(url, 'http://localhost'), {
    headers: { cookie: '_token=valid-jwt-token' },
  })
}

const TOKEN_MAX_AGE = 60 * 60 * 24 * 7

afterEach(() => {
  mockJwtVerify.mockClear()
  mockSign.mockClear()
})

/** 构造不带 token 的 NextRequest */
function makeAnonymousRequest(url: string) {
  const { NextRequest } = require('next/server')
  return new NextRequest(new URL(url, 'http://localhost'))
}

describe('token 自动续期', () => {
  it('无 token 时不续期', async () => {
    const res = await proxy(makeAnonymousRequest('http://localhost/posts/test'))
    expect(res.cookies.get('_token')).toBeUndefined()
    expect(mockSign).not.toHaveBeenCalled()
  })

  it('token 剩余有效期充足时不续期', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockJwtVerify.mockResolvedValueOnce({
      payload: { userId: 1, username: 'admin', role: 'owner', exp: now + TOKEN_MAX_AGE },
    })

    const res = await proxy(makeRequest('http://localhost/posts/test'))
    expect(res.cookies.get('_token')).toBeUndefined()
    expect(mockSign).not.toHaveBeenCalled()
  })

  it('token 剩余有效期不足一半时续期', async () => {
    const now = Math.floor(Date.now() / 1000)
    mockJwtVerify.mockResolvedValueOnce({
      payload: { userId: 1, username: 'admin', role: 'owner', exp: now + 1000 },
    })

    const res = await proxy(makeRequest('http://localhost/posts/test'))
    const cookie = res.cookies.get('_token')
    expect(cookie).toBeDefined()
    expect(cookie!.value).toBe('renewed-token')
    expect(mockSign).toHaveBeenCalledOnce()
  })

  it('token 无效时不续期', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid token'))

    const res = await proxy(makeRequest('http://localhost/posts/test'))
    expect(res.cookies.get('_token')).toBeUndefined()
    expect(mockSign).not.toHaveBeenCalled()
  })
})

describe('自定义后台路径 rewrite', () => {
  it('rewrite 到内部 /admin 路径', async () => {
    const res = await proxy(makeRequest('http://localhost/backstage/posts'))

    // rewrite 响应的 URL 包含内部路径
    expect(res.headers.get('x-middleware-rewrite')).toContain('/admin/posts')
  })

  it('rewrite 时保留 search 参数', async () => {
    const res = await proxy(makeRequest('http://localhost/backstage/posts?page=2&status=draft'))

    const rewriteUrl = res.headers.get('x-middleware-rewrite')!
    const parsed = new URL(rewriteUrl)
    expect(parsed.pathname).toBe('/admin/posts')
    expect(parsed.searchParams.get('page')).toBe('2')
    expect(parsed.searchParams.get('status')).toBe('draft')
  })

  it('根路径 rewrite 时保留 search 参数', async () => {
    const res = await proxy(makeRequest('http://localhost/backstage?tab=overview'))

    const rewriteUrl = res.headers.get('x-middleware-rewrite')!
    const parsed = new URL(rewriteUrl)
    expect(parsed.pathname).toBe('/admin')
    expect(parsed.searchParams.get('tab')).toBe('overview')
  })

  it('屏蔽旧的 /admin 路径', async () => {
    const res = await proxy(makeRequest('http://localhost/admin/posts'))

    const rewriteUrl = res.headers.get('x-middleware-rewrite')!
    expect(new URL(rewriteUrl).pathname).toBe('/__not_found')
  })
})
