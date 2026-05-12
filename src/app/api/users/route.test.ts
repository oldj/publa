import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireCurrentUser,
  mockRequireRecentReauth,
  mockRequireRole,
  mockListUsers,
  mockCreateUser,
  mockGetUserById,
  mockGetLastActiveMap,
  mockLogActivity,
} = vi.hoisted(() => ({
  mockRequireCurrentUser: vi.fn(),
  mockRequireRecentReauth: vi.fn(),
  mockRequireRole: vi.fn(),
  mockListUsers: vi.fn(),
  mockCreateUser: vi.fn(),
  mockGetUserById: vi.fn(),
  mockGetLastActiveMap: vi.fn(),
  mockLogActivity: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireCurrentUser: mockRequireCurrentUser,
  requireRecentReauth: mockRequireRecentReauth,
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/users', () => ({
  listUsers: mockListUsers,
  createUser: mockCreateUser,
  getUserById: mockGetUserById,
}))

vi.mock('@/server/services/activity-logs', () => ({
  getLastActiveMap: mockGetLastActiveMap,
  logActivity: mockLogActivity,
}))

const { GET, POST } = await import('./route')

describe('/api/users GET', () => {
  beforeEach(() => {
    mockRequireCurrentUser.mockReset()
    mockRequireRecentReauth.mockReset()
    mockRequireRole.mockReset()
    mockListUsers.mockReset()
    mockCreateUser.mockReset()
    mockGetUserById.mockReset()
    mockGetLastActiveMap.mockReset()
    mockLogActivity.mockReset()

    mockGetLastActiveMap.mockResolvedValue(new Map())
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockCreateUser.mockResolvedValue({
      id: 4,
      username: 'new-user',
      role: 'editor',
    })
  })

  it('未登录不能访问用户列表', async () => {
    mockRequireCurrentUser.mockResolvedValueOnce({
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
    expect(mockListUsers).not.toHaveBeenCalled()
  })

  it('管理员可以访问完整用户列表', async () => {
    mockRequireCurrentUser.mockResolvedValueOnce({
      ok: true,
      user: { id: 2, username: 'admin', role: 'admin' },
    })
    mockListUsers.mockResolvedValueOnce([
      { id: 1, username: 'owner', role: 'owner' },
      { id: 2, username: 'admin', role: 'admin' },
      { id: 3, username: 'editor', role: 'editor' },
    ])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(3)
    expect(mockListUsers).toHaveBeenCalled()
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('编辑只能看到自己', async () => {
    mockRequireCurrentUser.mockResolvedValueOnce({
      ok: true,
      user: { id: 3, username: 'editor1', role: 'editor' },
    })
    mockGetUserById.mockResolvedValueOnce({
      id: 3,
      username: 'editor1',
      role: 'editor',
      email: null,
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe(3)
    expect(mockListUsers).not.toHaveBeenCalled()
    expect(mockGetUserById).toHaveBeenCalledWith(3)
  })

  it('创建用户时会清洗用户名邮箱和密码', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })

    const response = await POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '  new-user  ',
          email: '  new@example.com  ',
          password: '  pass123  ',
          role: 'editor',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCreateUser).toHaveBeenCalledWith({
      username: 'new-user',
      email: 'new@example.com',
      password: 'pass123',
      role: 'editor',
    })
  })

  it('创建用户缺少二次验证时返回 REAUTH_REQUIRED', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'new-user',
          password: 'pass123',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it('清洗后为空时不会创建用户', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })

    const response = await POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '   ',
          password: '   ',
        }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(mockCreateUser).not.toHaveBeenCalled()
  })
})
