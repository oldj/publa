import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireRecentReauth,
  mockRequireRole,
  mockExportContentData,
  mockExportSettingsData,
  mockImportContentData,
  mockImportSettingsData,
  mockGetSetting,
  mockLogActivity,
} = vi.hoisted(() => ({
  mockRequireRecentReauth: vi.fn(),
  mockRequireRole: vi.fn(),
  mockExportContentData: vi.fn(),
  mockExportSettingsData: vi.fn(),
  mockImportContentData: vi.fn(),
  mockImportSettingsData: vi.fn(),
  mockGetSetting: vi.fn(),
  mockLogActivity: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRecentReauth: mockRequireRecentReauth,
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/import-export', async () => {
  const actual = await vi.importActual<typeof import('@/server/services/import-export')>(
    '@/server/services/import-export',
  )
  return {
    ...actual,
    exportContentData: mockExportContentData,
    exportSettingsData: mockExportSettingsData,
    importContentData: mockImportContentData,
    importSettingsData: mockImportSettingsData,
  }
})

vi.mock('@/server/services/settings', () => ({
  getSetting: mockGetSetting,
}))

vi.mock('@/server/services/activity-logs', () => ({
  logActivity: mockLogActivity,
}))

const { GET, POST } = await import('./route')

describe('/api/import-export POST', () => {
  beforeEach(() => {
    mockRequireRecentReauth.mockReset()
    mockRequireRole.mockReset()
    mockExportContentData.mockReset()
    mockExportSettingsData.mockReset()
    mockImportContentData.mockReset()
    mockImportSettingsData.mockReset()
    mockGetSetting.mockReset()
    mockLogActivity.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockExportContentData.mockResolvedValue({
      meta: { type: 'content', version: '2.0' },
      categories: [],
      tags: [],
      contents: [],
    })
    mockExportSettingsData.mockResolvedValue({
      meta: { type: 'settings', version: '2.0' },
      settings: [],
    })
    mockImportContentData.mockResolvedValue([{ key: 'contentItems', values: { count: 1 } }])
    mockImportSettingsData.mockResolvedValue([
      { key: 'settingsItems', values: { count: 1, defaultedCount: 0 } },
    ])
    mockGetSetting.mockResolvedValue('My Blog')
    mockLogActivity.mockResolvedValue(undefined)
  })

  it('未登录时返回 401', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
    })

    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
  })

  it('编辑不能导入数据', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'FORBIDDEN', message: '仅站长和管理员可导入数据' },
        { status: 403 },
      ),
    })

    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
  })

  it('缺少二次验证时不能导出数据', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await GET(new NextRequest('http://localhost/api/import-export?type=settings'))
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
  })

  it('二次验证有效时可以导出设置数据', async () => {
    const response = await GET(new NextRequest('http://localhost/api/import-export?type=settings'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.meta.type).toBe('settings')
    expect(response.headers.get('Content-Disposition')).toContain('My_Blog-settings-')
    expect(mockExportSettingsData).toHaveBeenCalled()
    expect(mockLogActivity).toHaveBeenCalledWith(expect.anything(), 1, 'export_data')
  })

  it('缺少二次验证时不能导入数据', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockImportContentData).not.toHaveBeenCalled()
    expect(mockImportSettingsData).not.toHaveBeenCalled()
  })

  it('管理员可以导入数据', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, username: 'admin', role: 'admin' },
    })

    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { type: 'content', version: '2.0' },
          categories: [],
          tags: [],
          contents: [],
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.results)).toBe(true)
    expect(typeof json.data.results[0]).toBe('string')
    expect(mockImportContentData).toHaveBeenCalledWith(expect.anything(), 2)
  })

  it('非法 JSON 返回 INVALID_FORMAT', async () => {
    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('INVALID_FORMAT')
    expect(mockImportContentData).not.toHaveBeenCalled()
    expect(mockImportSettingsData).not.toHaveBeenCalled()
  })

  it('结构合法但缺少必要字段时返回 VALIDATION_ERROR', async () => {
    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { type: 'content', version: '2.0' },
          categories: [],
          tags: [],
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(json.message).toContain('contents')
    expect(mockImportContentData).not.toHaveBeenCalled()
  })

  it('导入过程抛错时返回 IMPORT_FAILED', async () => {
    mockImportContentData.mockRejectedValueOnce(new Error('FOREIGN KEY constraint failed'))

    const response = await POST(
      new Request('http://localhost/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { type: 'content', version: '2.0' },
          categories: [],
          tags: [],
          contents: [],
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('IMPORT_FAILED')
    expect(typeof json.message).toBe('string')
    expect(json.message.length).toBeGreaterThan(0)
  })
})
