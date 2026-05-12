import { users } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockClearAuthCookie, mockClearReauthCookie, mockGetCurrentUser, mockLogActivity } =
  vi.hoisted(() => ({
    mockClearAuthCookie: vi.fn(),
    mockClearReauthCookie: vi.fn(),
    mockGetCurrentUser: vi.fn(),
    mockLogActivity: vi.fn(),
  }))

vi.mock('@/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth')>('@/server/auth')
  return {
    ...actual,
    clearAuthCookie: mockClearAuthCookie,
    clearReauthCookie: mockClearReauthCookie,
    getCurrentUser: mockGetCurrentUser,
  }
})

vi.mock('@/server/services/activity-logs', () => ({
  logActivity: mockLogActivity,
}))

const { POST } = await import('./route')

describe('/api/auth/logout POST', () => {
  beforeEach(async () => {
    await setupTestDb()

    mockClearAuthCookie.mockReset()
    mockClearReauthCookie.mockReset()
    mockGetCurrentUser.mockReset()
    mockLogActivity.mockReset()

    mockClearAuthCookie.mockResolvedValue(undefined)
    mockClearReauthCookie.mockResolvedValue(undefined)
    mockLogActivity.mockResolvedValue(undefined)
  })

  it('登出时同时清理登录 cookie 和二次验证 cookie', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 2, username: 'editor', role: 'editor' })

    const response = await POST(new Request('http://localhost/api/auth/logout') as any)
    const json = await response.json()
    const [user] = await testDb.select().from(users).where(eq(users.id, 2)).limit(1)

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockClearAuthCookie).toHaveBeenCalledTimes(1)
    expect(mockClearReauthCookie).toHaveBeenCalledTimes(1)
    expect(user?.tokenVersion).toBe(1)
    expect(mockLogActivity).toHaveBeenCalledWith(expect.anything(), 2, 'logout')
  })

  it('未登录登出时也会清理两类 cookie', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null)

    const response = await POST(new Request('http://localhost/api/auth/logout') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockClearAuthCookie).toHaveBeenCalledTimes(1)
    expect(mockClearReauthCookie).toHaveBeenCalledTimes(1)
    expect(mockLogActivity).not.toHaveBeenCalled()
  })
})
