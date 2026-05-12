import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockReauth } = vi.hoisted(() => ({
  mockReauth: vi.fn(),
}))

vi.mock('@/app/(admin)/_components/myModals', () => ({
  default: {
    reauth: mockReauth,
  },
}))

const { ensureReauth, sensitiveFetch } = await import('./sensitive-fetch')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sensitiveFetch', () => {
  beforeEach(() => {
    mockReauth.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('已有有效二次验证窗口时不会重复弹窗', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true }))

    const result = await ensureReauth()

    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/auth/reauth', { method: 'GET' })
    expect(mockReauth).not.toHaveBeenCalled()
  })

  it('遇到 REAUTH_REQUIRED 时验证成功后自动重试原请求', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ success: false, code: 'REAUTH_REQUIRED' }, 403))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    mockReauth.mockResolvedValueOnce(true)

    const response = await sensitiveFetch('/api/users', { method: 'POST' })
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(mockReauth).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/users', { method: 'POST' })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/users', { method: 'POST' })
  })

  it('用户取消二次验证时不重试原请求', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: false, code: 'REAUTH_REQUIRED' }, 403),
    )
    mockReauth.mockResolvedValueOnce(false)

    const response = await sensitiveFetch('/api/users', { method: 'POST' })
    const json = await response.json()

    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
