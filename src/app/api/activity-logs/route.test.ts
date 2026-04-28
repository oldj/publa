import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockListActivityLogs } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockListActivityLogs: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/activity-logs', () => ({
  listActivityLogs: mockListActivityLogs,
}))

const { GET } = await import('./route')

function makeRequest(query = '') {
  return new Request(`http://localhost/api/activity-logs${query}`) as any
}

describe('/api/activity-logs GET', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockListActivityLogs.mockReset()

    mockListActivityLogs.mockResolvedValue({
      total: 0,
      page: 1,
      pageSize: 20,
      items: [],
    })
  })

  it('未授权返回 401', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'UNAUTHORIZED' }, { status: 401 }),
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    expect(mockListActivityLogs).not.toHaveBeenCalled()
  })

  it('owner 默认参数：page=1, pageSize=20', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, role: 'owner' },
    })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockListActivityLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })

  it('显式传入 page / pageSize 透传', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, role: 'admin' },
    })

    const res = await GET(makeRequest('?page=3&pageSize=50'))
    expect(res.status).toBe(200)
    expect(mockListActivityLogs).toHaveBeenCalledWith({ page: 3, pageSize: 50 })
  })

  it('pageSize 超过上限被钳到 100', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, role: 'owner' },
    })

    const res = await GET(makeRequest('?pageSize=500'))
    expect(res.status).toBe(200)
    expect(mockListActivityLogs).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
  })

  it('非法 page 参数回退到默认值 1', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, role: 'owner' },
    })

    const res = await GET(makeRequest('?page=abc'))
    expect(res.status).toBe(200)
    expect(mockListActivityLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })
})
