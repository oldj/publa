import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockGetUserById, mockListUserActivityLogs } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockGetUserById: vi.fn(),
  mockListUserActivityLogs: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/users', () => ({
  getUserById: mockGetUserById,
}))

vi.mock('@/server/services/activity-logs', () => ({
  listUserActivityLogs: mockListUserActivityLogs,
}))

const { GET } = await import('./route')

function makeRequest(userId: string, query = '') {
  return new Request(`http://localhost/api/users/${userId}/activity-logs${query}`) as any
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('/api/users/[id]/activity-logs GET', () => {
  beforeEach(() => {
    mockRequireRole.mockReset()
    mockGetUserById.mockReset()
    mockListUserActivityLogs.mockReset()

    mockListUserActivityLogs.mockResolvedValue({
      total: 0,
      page: 1,
      pageSize: 30,
      items: [],
    })
  })

  it('未登录返回 401', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    })

    const res = await GET(makeRequest('1'), makeParams('1'))
    expect(res.status).toBe(401)
  })

  it('owner 可以查看任何用户的日志', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, role: 'owner' },
    })

    const res = await GET(makeRequest('2'), makeParams('2'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockListUserActivityLogs).toHaveBeenCalledWith({ userId: 2, page: 1, pageSize: 30 })
    // owner 不需要查目标用户角色
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('admin 可以查看 editor 的日志', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, role: 'admin' },
    })
    mockGetUserById.mockResolvedValueOnce({ id: 3, role: 'editor' })

    const res = await GET(makeRequest('3'), makeParams('3'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('admin 可以查看其他 admin 的日志', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, role: 'admin' },
    })
    mockGetUserById.mockResolvedValueOnce({ id: 4, role: 'admin' })

    const res = await GET(makeRequest('4'), makeParams('4'))
    expect(res.status).toBe(200)
  })

  it('admin 不能查看 owner 的日志', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, role: 'admin' },
    })
    mockGetUserById.mockResolvedValueOnce({ id: 1, role: 'owner' })

    const res = await GET(makeRequest('1'), makeParams('1'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.code).toBe('FORBIDDEN')
    expect(mockListUserActivityLogs).not.toHaveBeenCalled()
  })

  it('admin 查看不存在的用户返回 404', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, role: 'admin' },
    })
    mockGetUserById.mockResolvedValueOnce(null)

    const res = await GET(makeRequest('999'), makeParams('999'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })
})
