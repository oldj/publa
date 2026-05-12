import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireRecentReauth,
  mockRequireRole,
  mockGetAllSettings,
  mockNormalizeSettingsPayload,
  mockUpdateSettings,
  mockCreateStorageProvider,
} = vi.hoisted(() => ({
  mockRequireRecentReauth: vi.fn(),
  mockRequireRole: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockNormalizeSettingsPayload: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockCreateStorageProvider: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRecentReauth: mockRequireRecentReauth,
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/settings', () => ({
  getAllSettings: mockGetAllSettings,
  isSettingsValidationError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'name' in (error as Record<string, unknown>)),
  normalizeSettingsPayload: mockNormalizeSettingsPayload,
  STORAGE_SETTINGS_KEYS: [
    'storageProvider',
    'storageS3Endpoint',
    'storageS3Region',
    'storageS3Bucket',
    'storageS3AccessKey',
    'storageS3SecretKey',
    'storageOssRegion',
    'storageOssBucket',
    'storageOssAccessKeyId',
    'storageOssAccessKeySecret',
    'storageCosRegion',
    'storageCosBucket',
    'storageCosSecretId',
    'storageCosSecretKey',
    'storageR2AccountId',
    'storageR2Bucket',
    'storageR2AccessKey',
    'storageR2SecretKey',
    'attachmentBaseUrl',
  ],
  updateSettings: mockUpdateSettings,
}))

vi.mock('@/server/storage', () => ({
  createStorageProvider: mockCreateStorageProvider,
}))

const { GET, PUT, POST } = await import('./route')

describe('/api/attachments/config', () => {
  beforeEach(() => {
    mockRequireRecentReauth.mockReset()
    mockRequireRole.mockReset()
    mockGetAllSettings.mockReset()
    mockNormalizeSettingsPayload.mockReset()
    mockUpdateSettings.mockReset()
    mockCreateStorageProvider.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockGetAllSettings.mockResolvedValue({
      storageProvider: 's3',
      storageS3Endpoint: 'https://s3.example.com',
      storageS3Region: 'us-east-1',
      storageS3Bucket: 'blog-assets',
      storageS3AccessKey: 'AKIA-EXAMPLE',
      storageS3SecretKey: 'SECRET_KEY_VALUE',
      attachmentBaseUrl: 'https://cdn.example.com',
    })
    mockNormalizeSettingsPayload.mockImplementation((payload) => payload)
  })

  it('站长读取配置时只返回脱敏后的密钥', async () => {
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.storageS3SecretKey).toBe('SECR****ALUE')
    expect(json.data.storageS3AccessKey).toBe('AKIA-EXAMPLE')
  })

  it('编辑不能读取存储配置', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: '仅站长可查看存储配置' },
        { status: 403 },
      ),
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
  })

  it('管理员不能修改存储配置', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: '仅站长可修改存储配置' },
        { status: 403 },
      ),
    })

    const response = await PUT(
      new Request('http://localhost/api/attachments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageProvider: 's3' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('缺少二次验证时不能修改存储配置', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/attachments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageProvider: 's3' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('站长可以提交合法的存储配置', async () => {
    const response = await PUT(
      new Request('http://localhost/api/attachments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageProvider: 's3',
          storageS3Bucket: 'new-bucket',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockNormalizeSettingsPayload).toHaveBeenCalledWith(
      {
        storageProvider: 's3',
        storageS3Bucket: 'new-bucket',
      },
      expect.any(Array),
    )
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      storageProvider: 's3',
      storageS3Bucket: 'new-bucket',
    })
  })

  it('存储配置中的对象值会被拒绝', async () => {
    mockNormalizeSettingsPayload.mockImplementationOnce(() => {
      const error = Object.assign(new Error('Invalid settings values'), {
        name: 'SettingsValidationError',
        invalidKeys: [],
        invalidValueKeys: ['attachmentBaseUrl'],
        reason: 'INVALID_VALUES' as const,
      })
      throw error
    })

    const response = await PUT(
      new Request('http://localhost/api/attachments/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentBaseUrl: { url: 'https://cdn.example.com' },
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.message).toContain('attachmentBaseUrl')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('缺少二次验证时不能测试存储连接', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/attachments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 's3',
          endpoint: 'https://s3.example.com',
          bucket: 'blog-assets',
          accessKey: 'AKIA',
          secretKey: 'SECRET',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockCreateStorageProvider).not.toHaveBeenCalled()
  })

  it('测试连接失败时返回 CONNECTION_FAILED', async () => {
    mockCreateStorageProvider.mockResolvedValueOnce({
      testConnection: vi.fn().mockResolvedValue({ success: false, message: 'boom' }),
    })

    const response = await POST(
      new Request('http://localhost/api/attachments/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 's3',
          endpoint: 'https://s3.example.com',
          bucket: 'blog-assets',
          accessKey: 'AKIA',
          secretKey: 'SECRET',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.code).toBe('CONNECTION_FAILED')
    expect(typeof json.message).toBe('string')
  })
})
