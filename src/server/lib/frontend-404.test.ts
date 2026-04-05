import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockMatchRedirectRule, mockRedirect, mockPermanentRedirect, mockNotFound } = vi.hoisted(
  () => ({
    mockMatchRedirectRule: vi.fn(),
    mockRedirect: vi.fn(),
    mockPermanentRedirect: vi.fn(),
    mockNotFound: vi.fn(),
  }),
)

vi.mock('@/server/services/redirect-rules', () => ({
  matchRedirectRule: mockMatchRedirectRule,
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  permanentRedirect: mockPermanentRedirect,
  notFound: mockNotFound,
}))

const { redirectOrNotFound, redirectResponseOrNotFound } = await import('./frontend-404')

describe('frontend-404 helpers', () => {
  beforeEach(() => {
    mockMatchRedirectRule.mockReset()
    mockRedirect.mockReset()
    mockPermanentRedirect.mockReset()
    mockNotFound.mockReset()
  })

  it('永久规则命中时走 permanentRedirect', async () => {
    const redirectSignal = new Error('PERMANENT_REDIRECT')
    mockMatchRedirectRule.mockResolvedValue({
      destination: '/new',
      redirectType: '301',
      permanent: true,
      ruleId: 1,
    })
    mockPermanentRedirect.mockImplementation(() => {
      throw redirectSignal
    })

    await expect(redirectOrNotFound('/old')).rejects.toThrow('PERMANENT_REDIRECT')
    expect(mockPermanentRedirect).toHaveBeenCalledWith('/new')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('临时规则命中时走 redirect', async () => {
    const redirectSignal = new Error('TEMP_REDIRECT')
    mockMatchRedirectRule.mockResolvedValue({
      destination: '/new',
      redirectType: '302',
      permanent: false,
      ruleId: 1,
    })
    mockRedirect.mockImplementation(() => {
      throw redirectSignal
    })

    await expect(redirectOrNotFound('/old')).rejects.toThrow('TEMP_REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/new')
  })

  it('未命中时继续 notFound', async () => {
    const notFoundSignal = new Error('NOT_FOUND')
    mockMatchRedirectRule.mockResolvedValue(null)
    mockNotFound.mockImplementation(() => {
      throw notFoundSignal
    })

    await expect(redirectOrNotFound('/missing')).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('路由处理器可返回 308 跳转响应（外部 URL）', async () => {
    mockMatchRedirectRule.mockResolvedValue({
      destination: 'https://example.com/new',
      redirectType: '308',
      permanent: true,
      ruleId: 1,
    })

    const request = new Request('http://localhost/old')
    const response = await redirectResponseOrNotFound('/old', request)

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://example.com/new')
  })

  it('路由处理器可返回 307 跳转响应（站内路径）', async () => {
    mockMatchRedirectRule.mockResolvedValue({
      destination: '/new-path',
      redirectType: '302',
      permanent: false,
      ruleId: 2,
    })

    const request = new Request('http://localhost:3000/old')
    const response = await redirectResponseOrNotFound('/old', request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/new-path')
  })

  it('未命中时路由处理器返回 404', async () => {
    mockMatchRedirectRule.mockResolvedValue(null)

    const request = new Request('http://localhost/missing')
    const response = await redirectResponseOrNotFound('/missing', request)

    expect(response.status).toBe(404)
  })
})
