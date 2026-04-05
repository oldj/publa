import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyPassword } from '@/server/auth'
import { maybeFirst } from '@/server/db/query'
import { users } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'

const { mockCreateToken, mockSetAuthCookie, mockSeed } = vi.hoisted(() => ({
  mockCreateToken: vi.fn(),
  mockSetAuthCookie: vi.fn(),
  mockSeed: vi.fn(),
}))

vi.mock('@/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth')>('@/server/auth')
  return {
    ...actual,
    createToken: mockCreateToken,
    setAuthCookie: mockSetAuthCookie,
  }
})

vi.mock('@/server/db/seed', () => ({
  seed: mockSeed,
}))

const { POST } = await import('./route')

describe('/api/setup POST', () => {
  beforeEach(async () => {
    await setupTestDb()
    await testDb.delete(users)

    mockCreateToken.mockReset()
    mockSetAuthCookie.mockReset()
    mockSeed.mockReset()

    mockCreateToken.mockResolvedValue('test-token')
    mockSetAuthCookie.mockResolvedValue(undefined)
    mockSeed.mockResolvedValue(undefined)
  })

  it('初始化时会清洗用户名邮箱和密码', async () => {
    const response = await POST(new Request('http://localhost/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '  owner  ',
        email: '  owner@example.com  ',
        password: '  pass123  ',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)

    const saved = await maybeFirst(
      testDb.select().from(users).where(eq(users.role, 'owner')).limit(1),
    )
    expect(saved).not.toBeNull()
    expect(saved!.username).toBe('owner')
    expect(saved!.email).toBe('owner@example.com')
    expect(await verifyPassword('pass123', saved!.passwordHash)).toBe(true)
    expect(mockCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      username: 'owner',
      role: 'owner',
    }))
  })

  it('清洗后为空时返回校验错误', async () => {
    const response = await POST(new Request('http://localhost/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '   ',
        password: '      ',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')

    const allUsers = await testDb.select().from(users)
    expect(allUsers).toHaveLength(0)
  })
})
