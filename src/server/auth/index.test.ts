/**
 * tokenVersion 失效场景的端到端校验：
 * 覆盖「改密 / 登出 / 服务端自增 tokenVersion」之后，旧 JWT 立刻无法通过 getCurrentUser 的路径。
 */
import { users } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

const { createToken, getCurrentUser, verifyToken } = await import('./index')

beforeEach(async () => {
  await setupTestDb()
  mockCookies.mockReset()
})

function mockCookieValue(value: string | undefined) {
  mockCookies.mockResolvedValue({
    get: vi.fn().mockImplementation((name: string) =>
      name === '_token' && value !== undefined ? { value } : undefined,
    ),
    set: vi.fn(),
    delete: vi.fn(),
  })
}

describe('tokenVersion 失效机制', () => {
  it('createToken 会把当前 tokenVersion 写入 payload', async () => {
    const token = await createToken({ id: 2, username: 'editor', role: 'editor' })
    const payload = await verifyToken(token)
    expect(payload?.tokenVersion).toBe(0)

    await testDb
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, 2))

    const nextToken = await createToken({ id: 2, username: 'editor', role: 'editor' })
    const nextPayload = await verifyToken(nextToken)
    expect(nextPayload?.tokenVersion).toBe(1)
  })

  it('getCurrentUser 用匹配的 token 能识别用户', async () => {
    const token = await createToken({ id: 2, username: 'editor', role: 'editor' })
    mockCookieValue(token)

    const user = await getCurrentUser()
    expect(user).toEqual({ id: 2, username: 'editor', role: 'editor' })
  })

  it('改密后（tokenVersion 自增）旧 JWT 立即失效', async () => {
    // 1. 签发一个旧 token
    const oldToken = await createToken({ id: 2, username: 'editor', role: 'editor' })
    mockCookieValue(oldToken)
    expect(await getCurrentUser()).not.toBeNull()

    // 2. 模拟改密：自增 tokenVersion（与 users.updateUser 的 SQL 一致）
    await testDb
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, 2))

    // 3. 旧 token 本身 JWT 签名仍然合法（verifyToken 不读库，只校验签名）
    const payload = await verifyToken(oldToken)
    expect(payload).not.toBeNull()
    expect(payload!.tokenVersion).toBe(0)

    // 4. 但 getCurrentUser 会用 DB 当前版本做比对，拒绝旧 token
    expect(await getCurrentUser()).toBeNull()
  })

  it('登出后（tokenVersion 自增）旧 JWT 立即失效', async () => {
    // 登出走的就是同一份自增 SQL，这里直接模拟
    const oldToken = await createToken({ id: 2, username: 'editor', role: 'editor' })
    mockCookieValue(oldToken)
    expect(await getCurrentUser()).not.toBeNull()

    await testDb
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, 2))

    expect(await getCurrentUser()).toBeNull()
  })

  it('用户被删除后旧 JWT 失效', async () => {
    const oldToken = await createToken({ id: 2, username: 'editor', role: 'editor' })
    mockCookieValue(oldToken)
    expect(await getCurrentUser()).not.toBeNull()

    await testDb.delete(users).where(eq(users.id, 2))

    expect(await getCurrentUser()).toBeNull()
  })

  it('没有 token cookie 时 getCurrentUser 返回 null', async () => {
    mockCookieValue(undefined)
    expect(await getCurrentUser()).toBeNull()
  })

  it('伪造 / 篡改的 token 被拒绝', async () => {
    mockCookieValue('not-a-valid-jwt')
    expect(await getCurrentUser()).toBeNull()
  })
})
