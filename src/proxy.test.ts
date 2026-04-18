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
function makeRequest(url: string, init?: { method?: string; headers?: Record<string, string> }) {
  const { NextRequest } = require('next/server')
  const headers: Record<string, string> = {
    cookie: '_token=valid-jwt-token',
    ...(init?.headers ?? {}),
  }
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: init?.method ?? 'GET',
    headers,
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

describe('API 写方法 Origin 校验', () => {
  it('PUT 缺失 Origin → 403', async () => {
    const res = await proxy(
      makeRequest('https://local.oldj.net/api/posts/1/draft', { method: 'PUT' }),
    )

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN_ORIGIN')
  })

  it('PUT Origin hostname 与 Host 不一致 → 403', async () => {
    const res = await proxy(
      makeRequest('https://local.oldj.net/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://evil.com',
          host: 'local.oldj.net',
        },
      }),
    )

    expect(res.status).toBe(403)
  })

  // 回归用例：反代终结 TLS 但未转发 X-Forwarded-Proto，
  // Origin 是 https 而上游看到的是 http，hostname 相同应放行
  it('PUT Origin 为 https 而上游为 http、hostname 相同 → 放行', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://local.oldj.net',
          host: 'local.oldj.net',
        },
      }),
    )

    // 放行时直接 NextResponse.next()，不会是 403
    expect(res.status).not.toBe(403)
  })

  it('PUT Origin 省略默认端口、Host 带显式端口 → 放行', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://local.oldj.net',
          host: 'local.oldj.net:443',
        },
      }),
    )

    expect(res.status).not.toBe(403)
  })

  it('GET 请求无需 Origin 校验 → 放行', async () => {
    const res = await proxy(makeRequest('http://localhost/api/posts/1/draft', { method: 'GET' }))

    expect(res.status).not.toBe(403)
  })

  it('/api/cron/* 的 POST 无 Origin → 放行（豁免）', async () => {
    const res = await proxy(makeRequest('http://localhost/api/cron/publish', { method: 'POST' }))

    expect(res.status).not.toBe(403)
  })

  it('PUT hostname 大小写混写 → 放行', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://Local.OldJ.Net',
          host: 'local.oldj.net',
        },
      }),
    )

    expect(res.status).not.toBe(403)
  })

  // Sec-Fetch-Site 优先：即使 Host 被反代改写，也能正确放行
  it('PUT Sec-Fetch-Site=same-origin 且 Host 被反代改写 → 放行', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://local.oldj.net',
          host: 'localhost:3000',
          'sec-fetch-site': 'same-origin',
        },
      }),
    )

    expect(res.status).not.toBe(403)
  })

  it('PUT Sec-Fetch-Site=cross-site → 403', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://local.oldj.net',
          host: 'local.oldj.net',
          'sec-fetch-site': 'cross-site',
        },
      }),
    )

    expect(res.status).toBe(403)
  })

  it('PUT Sec-Fetch-Site=same-site → 403', async () => {
    const res = await proxy(
      makeRequest('http://localhost/api/posts/1/draft', {
        method: 'PUT',
        headers: {
          origin: 'https://api.local.oldj.net',
          host: 'local.oldj.net',
          'sec-fetch-site': 'same-site',
        },
      }),
    )

    expect(res.status).toBe(403)
  })
})
