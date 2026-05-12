import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireRecentReauth,
  mockRequireRole,
  mockGetAllSettings,
  mockNormalizeSettingsPayload,
  mockUpdateSettings,
} = vi.hoisted(() => ({
  mockRequireRecentReauth: vi.fn(),
  mockRequireRole: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockNormalizeSettingsPayload: vi.fn(),
  mockUpdateSettings: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRecentReauth: mockRequireRecentReauth,
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/settings', () => {
  const ADMIN_SETTINGS_KEYS = [
    'siteTitle',
    'enableComment',
    'showCommentsGlobally',
    'customHeadHtml',
  ] as const

  return {
    ADMIN_SETTINGS_KEYS,
    getAllSettings: mockGetAllSettings,
    isSettingsValidationError: (error: unknown) =>
      Boolean(error && typeof error === 'object' && 'name' in (error as Record<string, unknown>)),
    normalizeSettingsPayload: mockNormalizeSettingsPayload,
    updateSettings: mockUpdateSettings,
    pickSettings: (allSettings: Record<string, unknown>, keys: readonly string[]) => {
      const result: Record<string, unknown> = {}
      for (const key of keys) {
        result[key] = allSettings[key] ?? ''
      }
      return result
    },
  }
})

const { GET, PUT } = await import('./route')

describe('/api/settings', () => {
  beforeEach(() => {
    mockRequireRecentReauth.mockReset()
    mockRequireRole.mockReset()
    mockGetAllSettings.mockReset()
    mockNormalizeSettingsPayload.mockReset()
    mockUpdateSettings.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'admin' },
    })
    mockGetAllSettings.mockResolvedValue({
      siteTitle: 'Publa',
      enableComment: true,
      showCommentsGlobally: false,
      customHeadHtml: '',
      storageS3SecretKey: 'SECRET_VALUE',
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockNormalizeSettingsPayload.mockImplementation((payload) => payload)
  })

  it('未登录读取设置时返回 401', async () => {
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

  it('编辑不能读取设置', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      ),
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
  })

  it('管理员读取设置时不会拿到存储密钥', async () => {
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({
      siteTitle: 'Publa',
      enableComment: true,
      showCommentsGlobally: false,
      customHeadHtml: '',
    })
    expect(json.data.storageS3SecretKey).toBeUndefined()
  })

  it('管理员可以更新白名单内设置', async () => {
    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteTitle: 'New Title',
          enableComment: false,
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockNormalizeSettingsPayload).toHaveBeenCalledWith(
      {
        siteTitle: 'New Title',
        enableComment: false,
      },
      ['siteTitle', 'enableComment', 'showCommentsGlobally', 'customHeadHtml'],
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      siteTitle: 'New Title',
      enableComment: false,
    })
  })

  it('普通设置更新不需要二次验证', async () => {
    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteTitle: 'New Title',
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mockRequireRecentReauth).not.toHaveBeenCalled()
  })

  it('敏感 HTML 设置变化时需要二次验证', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customHeadHtml: '<script>alert(1)</script>',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('通过 /api/settings 写入敏感字段会被拒绝', async () => {
    mockNormalizeSettingsPayload.mockImplementationOnce(() => {
      const error = {
        name: 'SettingsValidationError',
        invalidKeys: ['storageS3SecretKey'],
        invalidValueKeys: [],
        reason: 'INVALID_KEYS',
      }
      throw error
    })

    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteTitle: 'New Title',
          storageS3SecretKey: 'SHOULD_NOT_PASS',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('通过 /api/settings 写入对象值会被拒绝', async () => {
    mockNormalizeSettingsPayload.mockImplementationOnce(() => {
      const error = {
        name: 'SettingsValidationError',
        invalidKeys: [],
        invalidValueKeys: ['siteTitle'],
        reason: 'INVALID_VALUES',
      }
      throw error
    })

    const response = await PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteTitle: { text: 'New Title' },
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.message).toContain('siteTitle')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})
