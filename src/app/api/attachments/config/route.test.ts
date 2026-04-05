import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockGetAllSettings, mockUpdateSettings, mockCreateStorageProvider } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockGetAllSettings: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockCreateStorageProvider: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/settings', () => ({
  getAllSettings: mockGetAllSettings,
  updateSettings: mockUpdateSettings,
}))

vi.mock('@/server/storage', () => ({
  createStorageProvider: mockCreateStorageProvider,
}))

const { GET, PUT } = await import('./route')

describe('/api/attachments/config', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockGetAllSettings.mockReset()
    mockUpdateSettings.mockReset()
    mockCreateStorageProvider.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockGetAllSettings.mockResolvedValue({
      storageProvider: 's3',
      storageS3Endpoint: 'https://s3.example.com',
      storageS3Region: 'us-east-1',
      storageS3Bucket: 'blog-assets',
      storageS3AccessKey: 'AKIA-EXAMPLE',
      storageS3SecretKey: 'SECRET_KEY_VALUE',
      attachmentBaseUrl: 'https://cdn.example.com',
    })
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

    const response = await PUT(new Request('http://localhost/api/attachments/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageProvider: 's3' }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })
})
