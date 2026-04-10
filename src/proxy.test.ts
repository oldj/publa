import { afterEach, describe, expect, it, vi } from 'vitest'

// mock jwt 校验，默认放行
const mockJwtVerify = vi.hoisted(() => vi.fn().mockResolvedValue({ payload: {} }))

vi.mock('jose', () => ({
  jwtVerify: mockJwtVerify,
}))

vi.mock('@/server/auth/shared', () => ({
  AUTH_COOKIE_NAME: '_token',
  getJwtSecret: () => new TextEncoder().encode('test-secret'),
  isAuthConfigError: () => false,
}))

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

afterEach(() => {
  mockJwtVerify.mockClear()
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
