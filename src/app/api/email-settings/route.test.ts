import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockGetAllSettings, mockNormalizeSettingsPayload, mockUpdateSettings } =
  vi.hoisted(() => ({
    mockRequireRole: vi.fn(),
    mockGetAllSettings: vi.fn(),
    mockNormalizeSettingsPayload: vi.fn(),
    mockUpdateSettings: vi.fn(),
  }))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/settings', () => ({
  EMAIL_SETTINGS_KEYS: [
    'emailProvider',
    'emailResendApiKey',
    'emailSmtpHost',
    'emailSmtpPort',
    'emailSmtpUsername',
    'emailSmtpPassword',
    'emailSmtpFrom',
    'emailSmtpEncryption',
    'emailNotifyNewComment',
    'emailNotifyNewGuestbook',
  ],
  getAllSettings: mockGetAllSettings,
  isSettingsValidationError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'name' in (error as Record<string, unknown>)),
  normalizeSettingsPayload: mockNormalizeSettingsPayload,
  pickSettings: (allSettings: Record<string, unknown>, keys: readonly string[]) => {
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      result[key] = allSettings[key] ?? ''
    }
    return result
  },
  updateSettings: mockUpdateSettings,
}))

const { GET, PUT } = await import('./route')

describe('/api/email-settings', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockGetAllSettings.mockReset()
    mockNormalizeSettingsPayload.mockReset()
    mockUpdateSettings.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockGetAllSettings.mockResolvedValue({
      emailProvider: 'smtp',
      emailSmtpFrom: 'noreply@example.com',
      emailSmtpPassword: 'secret-password',
      emailNotifyNewComment: { enabled: true, userIds: [1] },
    })
    mockNormalizeSettingsPayload.mockImplementation((payload) => payload)
  })

  it('读取时会掩码敏感字段', async () => {
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.emailSmtpPassword).toBe('••••••••')
    expect(json.data.emailSmtpFrom).toBe('noreply@example.com')
  })

  it('保存合法邮件设置时会先走统一规范化', async () => {
    const response = await PUT(
      new Request('http://localhost/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailProvider: 'smtp',
          emailNotifyNewComment: { enabled: true, userIds: [1, 2] },
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockNormalizeSettingsPayload).toHaveBeenCalledWith(
      {
        emailProvider: 'smtp',
        emailNotifyNewComment: { enabled: true, userIds: [1, 2] },
      },
      expect.any(Array),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      emailProvider: 'smtp',
      emailNotifyNewComment: { enabled: true, userIds: [1, 2] },
    })
  })

  it('非法通知配置会被拒绝', async () => {
    mockNormalizeSettingsPayload.mockImplementationOnce(() => {
      const error = Object.assign(new Error('Invalid settings values'), {
        name: 'SettingsValidationError',
        invalidKeys: [],
        invalidValueKeys: ['emailNotifyNewComment'],
        reason: 'INVALID_VALUES' as const,
      })
      throw error
    })

    const response = await PUT(
      new Request('http://localhost/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifyNewComment: { enabled: true, userIds: ['x'] },
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.message).toContain('emailNotifyNewComment')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('掩码密码不会覆盖原值', async () => {
    const response = await PUT(
      new Request('http://localhost/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSmtpPassword: '••••••••',
          emailSmtpFrom: 'noreply@example.com',
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mockNormalizeSettingsPayload).toHaveBeenCalledWith(
      {
        emailSmtpFrom: 'noreply@example.com',
      },
      expect.any(Array),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      emailSmtpFrom: 'noreply@example.com',
    })
  })

  it('未登录时返回 401', async () => {
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
})
