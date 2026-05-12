import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockReauth } = vi.hoisted(() => ({
  mockReauth: vi.fn(),
}))

vi.mock('@/app/(admin)/_components/myModals', () => ({
  default: {
    reauth: mockReauth,
  },
}))

const { ensureReauth, sensitiveJsonFetch, sensitiveUploadFetch } = await import('./sensitive-fetch')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('sensitiveJsonFetch', () => {
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

    const response = await sensitiveJsonFetch('/api/users', { method: 'POST' })
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

    const response = await sensitiveJsonFetch('/api/users', { method: 'POST' })
    const json = await response.json()

    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('拒绝 FormData 这类不可作为 JSON 重试的请求体', async () => {
    await expect(
      sensitiveJsonFetch('/api/users', {
        method: 'POST',
        body: new FormData(),
      } as any),
    ).rejects.toThrow(TypeError)

    expect(fetch).not.toHaveBeenCalled()
    expect(mockReauth).not.toHaveBeenCalled()
  })
})

describe('sensitiveUploadFetch', () => {
  beforeEach(() => {
    mockReauth.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('FormData 请求遇到 REAUTH_REQUIRED 后弹窗并复用同一份 body 重试', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ success: false, code: 'REAUTH_REQUIRED' }, 403))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    mockReauth.mockResolvedValueOnce(true)

    const formData = new FormData()
    formData.append('file', new Blob(['x'], { type: 'image/png' }), 'icon.png')

    const response = await sensitiveUploadFetch('/api/settings/favicon', {
      method: 'POST',
      body: formData,
    })
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(mockReauth).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    // 两次 fetch 复用同一个 FormData 引用，便于浏览器/Node 重新序列化
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(formData)
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe(formData)
  })

  it('用户取消二次验证后不重试', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: false, code: 'REAUTH_REQUIRED' }, 403),
    )
    mockReauth.mockResolvedValueOnce(false)

    const response = await sensitiveUploadFetch('/api/settings/favicon', {
      method: 'POST',
      body: new FormData(),
    })

    expect(response.status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
