import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireRole,
  mockRequireRecentReauth,
  mockGetFaviconConfig,
  mockSaveUploadedFavicon,
  mockSaveFaviconUrl,
  mockResetFavicon,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockRequireRecentReauth: vi.fn(),
  mockGetFaviconConfig: vi.fn(),
  mockSaveUploadedFavicon: vi.fn(),
  mockSaveFaviconUrl: vi.fn(),
  mockResetFavicon: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
  requireRecentReauth: mockRequireRecentReauth,
}))

vi.mock('@/server/services/favicon', () => ({
  getFaviconConfig: mockGetFaviconConfig,
  saveUploadedFavicon: mockSaveUploadedFavicon,
  saveFaviconUrl: mockSaveFaviconUrl,
  resetFavicon: mockResetFavicon,
  isFaviconError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'code' in (error as Record<string, unknown>)),
}))

const { GET, POST, PUT, DELETE } = await import('./route')

const faviconResponse = {
  mode: 'upload',
  url: '',
  mimeType: 'image/png',
  version: 'abc123',
  previewUrl: '/favicon.ico?v=abc123',
}

describe('/api/settings/favicon', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockRequireRecentReauth.mockReset()
    mockGetFaviconConfig.mockReset()
    mockSaveUploadedFavicon.mockReset()
    mockSaveFaviconUrl.mockReset()
    mockResetFavicon.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'admin' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockGetFaviconConfig.mockResolvedValue(faviconResponse)
    mockSaveUploadedFavicon.mockResolvedValue(faviconResponse)
    mockSaveFaviconUrl.mockResolvedValue({
      mode: 'url',
      url: 'https://cdn.example.com/favicon.png',
      mimeType: '',
      version: 'url123',
      previewUrl: '/favicon.ico?v=url123',
    })
    mockResetFavicon.mockResolvedValue({
      mode: 'default',
      url: '',
      mimeType: '',
      version: '',
      previewUrl: '/favicon.ico?v=default',
    })
  })

  it('未登录读取时返回 401', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
  })

  it('读取当前 favicon 配置', async () => {
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(faviconResponse)
  })

  it('上传图标文件后返回新的配置', async () => {
    const formData = new FormData()
    formData.append('file', new File(['icon-data'], 'icon.png', { type: 'image/png' }))

    const response = await POST(
      new Request('http://localhost/api/settings/favicon', {
        method: 'POST',
        body: formData,
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockSaveUploadedFavicon).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      originalFilename: 'icon.png',
      mimeType: 'image/png',
    })
    expect(mockRequireRecentReauth).toHaveBeenCalled()
  })

  it('缺少二次验证时不能上传图标文件', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/settings/favicon', {
        method: 'POST',
        body: new FormData(),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockSaveUploadedFavicon).not.toHaveBeenCalled()
  })

  it('未上传文件时返回校验错误', async () => {
    const response = await POST(
      new Request('http://localhost/api/settings/favicon', {
        method: 'POST',
        body: new FormData(),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('URL 模式拒绝非 https 地址', async () => {
    mockSaveFaviconUrl.mockRejectedValueOnce({ code: 'INVALID_URL' })

    const response = await PUT(
      new Request('http://localhost/api/settings/favicon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://cdn.example.com/favicon.png' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('图标 URL 仅支持 https:// 地址')
  })

  it('缺少二次验证时不能设置 favicon URL', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/settings/favicon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.example.com/favicon.png' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockSaveFaviconUrl).not.toHaveBeenCalled()
  })

  it('恢复默认图标', async () => {
    const response = await DELETE(new Request('http://localhost/api/settings/favicon') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.previewUrl).toBe('/favicon.ico?v=default')
  })

  it('缺少二次验证时不能恢复默认图标', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await DELETE(new Request('http://localhost/api/settings/favicon') as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockResetFavicon).not.toHaveBeenCalled()
  })
})
