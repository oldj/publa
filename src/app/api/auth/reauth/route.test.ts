import { hashPassword } from '@/server/auth'
import { rateEvents, users } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateReauthToken,
  mockRequireCurrentUser,
  mockRequireRecentReauth,
  mockSetReauthCookie,
} = vi.hoisted(() => ({
  mockCreateReauthToken: vi.fn(),
  mockRequireCurrentUser: vi.fn(),
  mockRequireRecentReauth: vi.fn(),
  mockSetReauthCookie: vi.fn(),
}))

vi.mock('@/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth')>('@/server/auth')
  return {
    ...actual,
    createReauthToken: mockCreateReauthToken,
    requireCurrentUser: mockRequireCurrentUser,
    requireRecentReauth: mockRequireRecentReauth,
    setReauthCookie: mockSetReauthCookie,
  }
})

const { GET, POST } = await import('./route')

describe('/api/auth/reauth', () => {
  beforeEach(async () => {
    await setupTestDb()
    await testDb.delete(users)
    await testDb.insert(users).values({
      id: 1,
      username: 'owner',
      passwordHash: await hashPassword('pass123'),
      role: 'owner',
    })

    mockCreateReauthToken.mockReset()
    mockRequireCurrentUser.mockReset()
    mockRequireRecentReauth.mockReset()
    mockSetReauthCookie.mockReset()

    mockRequireCurrentUser.mockResolvedValue({
      ok: true,
      user: { id: 1, username: 'owner', role: 'owner' },
    })
    mockRequireRecentReauth.mockResolvedValue({ ok: true })
    mockCreateReauthToken.mockResolvedValue('reauth-token')
    mockSetReauthCookie.mockResolvedValue(undefined)
  })

  it('密码正确时签发二次验证 cookie', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockCreateReauthToken).toHaveBeenCalledWith({
      id: 1,
      username: 'owner',
      role: 'owner',
    })
    expect(mockSetReauthCookie).toHaveBeenCalledWith('reauth-token')
  })

  it('密码错误时返回 INVALID_PASSWORD', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/reauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.10',
        },
        body: JSON.stringify({ password: 'wrong' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('INVALID_PASSWORD')
    expect(mockCreateReauthToken).not.toHaveBeenCalled()
    expect(mockSetReauthCookie).not.toHaveBeenCalled()

    const events = await testDb.select().from(rateEvents)
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('login_fail')
    expect(events[0].identifier).toBe('owner')
  })

  it('近期验证有效时状态检查返回成功', async () => {
    const response = await GET(new Request('http://localhost/api/auth/reauth') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('缺少近期验证时状态检查返回 REAUTH_REQUIRED', async () => {
    mockRequireRecentReauth.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ success: false, code: 'REAUTH_REQUIRED' }, { status: 403 }),
    })

    const response = await GET(new Request('http://localhost/api/auth/reauth') as any)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.code).toBe('REAUTH_REQUIRED')
  })
})
