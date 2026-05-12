import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireCurrentUser,
  mockRequireRecentReauth,
  mockGetUserById,
  mockUpdateUser,
  mockDeleteUser,
} = vi.hoisted(() => ({
  mockRequireCurrentUser: vi.fn(),
  mockRequireRecentReauth: vi.fn(),
  mockGetUserById: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
}))

vi.mock('@/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth')>('@/server/auth')
  return {
    ...actual,
    requireCurrentUser: mockRequireCurrentUser,
    requireRecentReauth: mockRequireRecentReauth,
  }
})

vi.mock('@/server/services/users', async () => {
  const actual =
    await vi.importActual<typeof import('@/server/services/users')>('@/server/services/users')
  return {
    ...actual,
    getUserById: mockGetUserById,
    updateUser: mockUpdateUser,
    deleteUser: mockDeleteUser,
  }
})

const { DELETE, PUT } = await import('./route')

describe('/api/users/[id] PUT', () => {
  beforeEach(() => {
    mockRequireCurrentUser.mockReset()
    mockRequireRecentReauth.mockReset()
    mockGetUserById.mockReset()
    mockUpdateUser.mockReset()
    mockDeleteUser.mockReset()

    mockRequireCurrentUser.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockGetUserById.mockResolvedValue({
      id: 2,
      username: 'editor',
      email: null,
      role: 'editor',
      createdAt: '2026-04-01T00:00:00.000Z',
    })
    mockUpdateUser.mockResolvedValue({
      id: 2,
      username: 'new-editor',
      email: 'new@example.com',
      role: 'editor',
    })
    mockDeleteUser.mockResolvedValue({ success: true })
  })

  it('更新用户时会清洗用户名邮箱和密码', async () => {
    const response = await PUT(
      new Request('http://localhost/api/users/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '  new-editor  ',
          email: '  new@example.com  ',
          password: '  pass123  ',
        }),
      }) as any,
      {
        params: Promise.resolve({ id: '2' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith(2, {
      username: 'new-editor',
      email: 'new@example.com',
      password: 'pass123',
    })
  })

  it('清洗后为空的密码会被拒绝', async () => {
    const response = await PUT(
      new Request('http://localhost/api/users/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'editor',
          password: '   ',
        }),
      }) as any,
      {
        params: Promise.resolve({ id: '2' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('缺少二次验证时不会更新用户', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await PUT(
      new Request('http://localhost/api/users/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'editor',
        }),
      }) as any,
      {
        params: Promise.resolve({ id: '2' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('未登录时返回 401', async () => {
    mockRequireCurrentUser.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
    })

    const response = await PUT(
      new Request('http://localhost/api/users/2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'editor',
        }),
      }) as any,
      {
        params: Promise.resolve({ id: '2' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
  })

  it('缺少二次验证时不会删除用户', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await DELETE(
      new Request('http://localhost/api/users/2', {
        method: 'DELETE',
      }) as any,
      {
        params: Promise.resolve({ id: '2' }),
      },
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})
