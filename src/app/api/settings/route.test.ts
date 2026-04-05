import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockGetAllSettings, mockUpdateSettings } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockUpdateSettings: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/settings', () => {
  const ADMIN_SETTINGS_KEYS = ['siteTitle', 'enableComment', 'showCommentsGlobally'] as const

  return {
    ADMIN_SETTINGS_KEYS,
    getAllSettings: mockGetAllSettings,
    updateSettings: mockUpdateSettings,
    pickSettings: (allSettings: Record<string, string>, keys: readonly string[]) => {
      const result: Record<string, string> = {}
      for (const key of keys) {
        result[key] = allSettings[key] || ''
      }
      return result
    },
  }
})

const { GET, PUT } = await import('./route')

describe('/api/settings', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockGetAllSettings.mockReset()
    mockUpdateSettings.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'admin' },
    })
    mockGetAllSettings.mockResolvedValue({
      siteTitle: 'Publa',
      enableComment: 'true',
      showCommentsGlobally: 'false',
      storageS3SecretKey: 'SECRET_VALUE',
    })
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
      enableComment: 'true',
      showCommentsGlobally: 'false',
    })
    expect(json.data.storageS3SecretKey).toBeUndefined()
  })

  it('管理员可以更新白名单内设置', async () => {
    const response = await PUT(new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteTitle: 'New Title',
        enableComment: 'false',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      siteTitle: 'New Title',
      enableComment: 'false',
    })
  })

  it('通过 /api/settings 写入敏感字段会被拒绝', async () => {
    const response = await PUT(new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteTitle: 'New Title',
        storageS3SecretKey: 'SHOULD_NOT_PASS',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})
