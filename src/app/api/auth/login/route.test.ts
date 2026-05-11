import { hashPassword } from '@/server/auth'
import { activityLogs, rateEvents, users } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateToken, mockSetAuthCookie } = vi.hoisted(() => ({
  mockCreateToken: vi.fn(),
  mockSetAuthCookie: vi.fn(),
}))

vi.mock('@/server/auth', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth')>('@/server/auth')
  return {
    ...actual,
    createToken: mockCreateToken,
    setAuthCookie: mockSetAuthCookie,
  }
})

const { POST } = await import('./route')

describe('/api/auth/login POST', () => {
  beforeEach(async () => {
    await setupTestDb()
    await testDb.delete(users)
    await testDb.insert(users).values({
      username: 'owner',
      passwordHash: await hashPassword('pass123'),
      role: 'owner',
    })

    mockCreateToken.mockReset()
    mockSetAuthCookie.mockReset()
    mockCreateToken.mockResolvedValue('login-token')
    mockSetAuthCookie.mockResolvedValue(undefined)
  })

  it('会使用清洗后的用户名和密码登录', async () => {
    const firstResponse = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '  owner  ',
          password: 'pass123',
        }),
      }) as any,
    )
    const firstJson = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(firstJson.success).toBe(true)

    const secondResponse = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'owner',
          password: '  pass123  ',
        }),
      }) as any,
    )
    const secondJson = await secondResponse.json()

    expect(secondResponse.status).toBe(200)
    expect(secondJson.success).toBe(true)
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'owner',
        role: 'owner',
      }),
    )
  })

  it('清洗后为空时返回校验错误', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
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
  })

  it('密码错误时记录 login_fail 限流事件和活动日志', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.1',
          'user-agent': 'test-agent',
        },
        body: JSON.stringify({ username: 'owner', password: 'wrong' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('INVALID_CREDENTIALS')

    const events = await testDb.select().from(rateEvents)
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('login_fail')
    expect(events[0].identifier).toBe('owner')

    const logs = await testDb.select().from(activityLogs)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('login_fail')
    expect(logs[0].ipAddress).toBe('198.51.100.1')
    expect(logs[0].userAgent).toBe('test-agent')
  })

  it('用户不存在时也记录 login_fail 限流事件，但不写活动日志', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nonexistent', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('INVALID_CREDENTIALS')

    const events = await testDb.select().from(rateEvents)
    expect(events).toHaveLength(1)
    expect(events[0].identifier).toBe('nonexistent')

    const logs = await testDb.select().from(activityLogs)
    expect(logs).toHaveLength(0)
  })

  it('连续失败 5 次后锁定账号', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'owner', password: 'wrong' }),
        }) as any,
      )
    }

    // 第 6 次请求（即使密码正确）也应被锁定
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.code).toBe('ACCOUNT_LOCKED')

    const events = await testDb.select().from(rateEvents)
    expect(events.some((event) => event.eventType === 'login_lock_username')).toBe(true)
  })

  it('更换 IP 连续尝试同一用户名仍会触发用户名锁定', async () => {
    for (let i = 0; i < 5; i++) {
      await POST(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `10.0.0.${i}`,
          },
          body: JSON.stringify({ username: 'owner', password: 'wrong' }),
        }) as any,
      )
    }

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.99',
        },
        body: JSON.stringify({ username: 'owner', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.code).toBe('ACCOUNT_LOCKED')
  })

  it('同一 IP 失败达到阈值后会锁定该 IP', async () => {
    await testDb.insert(rateEvents).values(
      Array.from({ length: 30 }, (_, index) => ({
        eventType: 'login_fail' as const,
        identifier: `user-${index}`,
        ipAddress: '203.0.113.1',
      })),
    )

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.1',
        },
        body: JSON.stringify({ username: 'owner', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.code).toBe('ACCOUNT_LOCKED')

    const events = await testDb.select().from(rateEvents)
    expect(events.some((event) => event.eventType === 'login_lock_ip')).toBe(true)
  })

  it('登录成功时不记录事件', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)

    const events = await testDb.select().from(rateEvents)
    expect(events).toHaveLength(0)
  })

  it('登录成功时清理该用户名失败记录', async () => {
    await testDb.insert(rateEvents).values([
      { eventType: 'login_fail', identifier: 'owner', ipAddress: '127.0.0.1' },
      { eventType: 'login_fail', identifier: 'other', ipAddress: '127.0.0.1' },
    ])

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'owner', password: 'pass123' }),
      }) as any,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)

    const events = await testDb.select().from(rateEvents)
    expect(
      events.some((event) => event.eventType === 'login_fail' && event.identifier === 'owner'),
    ).toBe(false)
    expect(
      events.some((event) => event.eventType === 'login_fail' && event.identifier === 'other'),
    ).toBe(true)
  })
})
