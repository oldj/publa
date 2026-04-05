import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireRole,
  mockListRedirectRules,
  mockCreateRedirectRule,
  mockReorderRedirectRules,
  mockGetRedirectRuleById,
  mockUpdateRedirectRule,
  mockDeleteRedirectRule,
  MockRedirectRuleValidationError,
} = vi.hoisted(() => {
  class MockRedirectRuleValidationError extends Error {
    code: string

    constructor(code: string) {
      super(code)
      this.name = 'RedirectRuleValidationError'
      this.code = code
    }
  }

  return {
    mockRequireRole: vi.fn(),
    mockListRedirectRules: vi.fn(),
    mockCreateRedirectRule: vi.fn(),
    mockReorderRedirectRules: vi.fn(),
    mockGetRedirectRuleById: vi.fn(),
    mockUpdateRedirectRule: vi.fn(),
    mockDeleteRedirectRule: vi.fn(),
    MockRedirectRuleValidationError,
  }
})

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/redirect-rules', () => ({
  listRedirectRules: mockListRedirectRules,
  createRedirectRule: mockCreateRedirectRule,
  reorderRedirectRules: mockReorderRedirectRules,
  getRedirectRuleById: mockGetRedirectRuleById,
  updateRedirectRule: mockUpdateRedirectRule,
  deleteRedirectRule: mockDeleteRedirectRule,
  RedirectRuleValidationError: MockRedirectRuleValidationError,
}))

const collectionRoute = await import('./route')
const itemRoute = await import('./[id]/route')

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
    { status: 401 },
  )
}

describe('/api/redirect-rules', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockListRedirectRules.mockReset()
    mockCreateRedirectRule.mockReset()
    mockReorderRedirectRules.mockReset()
    mockGetRedirectRuleById.mockReset()
    mockUpdateRedirectRule.mockReset()
    mockDeleteRedirectRule.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'owner' },
    })
  })

  it('未登录不能读取规则列表', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: unauthorizedResponse(),
    })

    const response = await collectionRoute.GET()
    expect(response.status).toBe(401)
  })

  it('owner/admin 可以读取规则列表', async () => {
    mockListRedirectRules.mockResolvedValue([
      { id: 1, order: 1, pathRegex: '^/old$', redirectTo: '/new', redirectType: '301', memo: null },
    ])

    const response = await collectionRoute.GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('可以创建规则', async () => {
    mockCreateRedirectRule.mockResolvedValue({
      id: 1,
      order: 1,
      pathRegex: '^/old$',
      redirectTo: '/new',
      redirectType: '301',
      memo: null,
    })

    const response = await collectionRoute.POST(
      new Request('http://localhost/api/redirect-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathRegex: '^/old$',
          redirectTo: '/new',
          redirectType: '301',
        }),
      }) as NextRequest,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCreateRedirectRule).toHaveBeenCalled()
  })

  it('可以提交重排请求', async () => {
    mockReorderRedirectRules.mockResolvedValue({ success: true })

    const response = await collectionRoute.POST(
      new Request('http://localhost/api/redirect-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          ids: [3, 1, 2],
        }),
      }) as NextRequest,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockReorderRedirectRules).toHaveBeenCalledWith([3, 1, 2])
  })

  it('校验错误返回 400', async () => {
    mockCreateRedirectRule.mockRejectedValue(
      new MockRedirectRuleValidationError('INVALID_PATH_REGEX'),
    )

    const response = await collectionRoute.POST(
      new Request('http://localhost/api/redirect-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathRegex: '(',
          redirectTo: '/new',
          redirectType: '301',
        }),
      }) as NextRequest,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})

describe('/api/redirect-rules/[id]', () => {
  beforeEach(() => {
    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'owner' },
    })
  })

  it('更新不存在的规则返回 404', async () => {
    mockUpdateRedirectRule.mockResolvedValue(null)

    const response = await itemRoute.PUT(
      new Request('http://localhost/api/redirect-rules/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathRegex: '^/old$',
          redirectTo: '/new',
          redirectType: '301',
        }),
      }) as NextRequest,
      {
        params: Promise.resolve({ id: '1' }),
      },
    )

    expect(response.status).toBe(404)
  })

  it('可以更新规则', async () => {
    mockUpdateRedirectRule.mockResolvedValue({
      id: 1,
      order: 1,
      pathRegex: '^/old$',
      redirectTo: '/new',
      redirectType: '302',
      memo: null,
    })

    const response = await itemRoute.PUT(
      new Request('http://localhost/api/redirect-rules/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathRegex: '^/old$',
          redirectTo: '/new',
          redirectType: '302',
        }),
      }) as NextRequest,
      {
        params: Promise.resolve({ id: '1' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.redirectType).toBe('302')
  })

  it('删除不存在的规则返回 404', async () => {
    mockGetRedirectRuleById.mockResolvedValue(null)

    const response = await itemRoute.DELETE(
      new Request('http://localhost/api/redirect-rules/1') as NextRequest,
      {
        params: Promise.resolve({ id: '1' }),
      },
    )

    expect(response.status).toBe(404)
  })

  it('可以删除规则', async () => {
    mockGetRedirectRuleById.mockResolvedValue({
      id: 1,
      order: 1,
      pathRegex: '^/old$',
      redirectTo: '/new',
      redirectType: '301',
      memo: null,
    })
    mockDeleteRedirectRule.mockResolvedValue({ success: true })

    const response = await itemRoute.DELETE(
      new Request('http://localhost/api/redirect-rules/1') as NextRequest,
      {
        params: Promise.resolve({ id: '1' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDeleteRedirectRule).toHaveBeenCalledWith(1)
  })
})
