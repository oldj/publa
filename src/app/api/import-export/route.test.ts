import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockImportContentData, mockImportSettingsData } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockImportContentData: vi.fn(),
  mockImportSettingsData: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/import-export', async () => {
  const actual = await vi.importActual<typeof import('@/server/services/import-export')>(
    '@/server/services/import-export',
  )
  return {
    ...actual,
    importContentData: mockImportContentData,
    importSettingsData: mockImportSettingsData,
  }
})

const { POST } = await import('./route')

describe('/api/import-export POST', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockImportContentData.mockReset()
    mockImportSettingsData.mockReset()

    mockRequireRole.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'admin', role: 'owner' },
    })
    mockImportContentData.mockResolvedValue(['文章: 1 条'])
    mockImportSettingsData.mockResolvedValue(['设置: 1 条'])
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
    expect(json.message).toContain('FOREIGN KEY constraint failed')
  })
})
