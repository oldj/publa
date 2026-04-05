import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRunDailyTasks } = vi.hoisted(() => ({
  mockRunDailyTasks: vi.fn(),
}))

vi.mock('@/cron/1d', () => ({
  runDailyTasks: mockRunDailyTasks,
}))

const { GET } = await import('./route')

function createCronRequest(url: string, init?: ConstructorParameters<typeof Request>[1]) {
  const request = new Request(url, init) as Request & { nextUrl: URL }
  request.nextUrl = new URL(url)
  return request
}

describe('/api/cron/1d', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    mockRunDailyTasks.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('生产环境未配置密钥时返回 503', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.CRON_SECRET

    const response = await GET(createCronRequest('http://localhost/api/cron/1d') as any)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.code).toBe('CONFIGURATION_ERROR')
    expect(mockRunDailyTasks).not.toHaveBeenCalled()
  })

  it('密钥错误时返回 401', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.CRON_SECRET = 'expected-secret'

    const request = createCronRequest('http://localhost/api/cron/1d', {
      headers: { 'x-cron-secret': 'wrong-secret' },
    })
    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
    expect(mockRunDailyTasks).not.toHaveBeenCalled()
  })

  it('通过 x-cron-secret 传递正确密钥', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.CRON_SECRET = 'expected-secret'

    const request = createCronRequest('http://localhost/api/cron/1d', {
      headers: { 'x-cron-secret': 'expected-secret' },
    })

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockRunDailyTasks).toHaveBeenCalledOnce()
  })

  it('通过 Authorization Bearer 传递正确密钥', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.CRON_SECRET = 'expected-secret'

    const request = createCronRequest('http://localhost/api/cron/1d', {
      headers: { authorization: 'Bearer expected-secret' },
    })

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockRunDailyTasks).toHaveBeenCalledOnce()
  })
})
