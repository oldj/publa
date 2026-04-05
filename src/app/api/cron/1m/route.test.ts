import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { mockRunOneMinuteTasks } = vi.hoisted(() => ({
  mockRunOneMinuteTasks: vi.fn(),
}))

vi.mock('@/cron/1m', () => ({
  runOneMinuteTasks: mockRunOneMinuteTasks,
}))

const { GET } = await import('./route')

function createCronRequest(url: string, init?: ConstructorParameters<typeof Request>[1]) {
  const request = new Request(url, init) as Request & { nextUrl: URL }
  request.nextUrl = new URL(url)
  return request
}

describe('/api/cron/1m', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    mockRunOneMinuteTasks.mockReset()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('生产环境未配置密钥时返回 503', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.CRON_SECRET

    const response = await GET(createCronRequest('http://localhost/api/cron/1m') as any)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.code).toBe('CONFIGURATION_ERROR')
    expect(mockRunOneMinuteTasks).not.toHaveBeenCalled()
  })

  it('密钥错误时返回 401', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.CRON_SECRET = 'expected-secret'

    const response = await GET(createCronRequest('http://localhost/api/cron/1m?secret=wrong-secret') as any)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
    expect(mockRunOneMinuteTasks).not.toHaveBeenCalled()
  })

  it('密钥正确时调用定时任务函数', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    process.env.CRON_SECRET = 'expected-secret'

    const request = createCronRequest('http://localhost/api/cron/1m', {
      headers: { 'x-cron-secret': 'expected-secret' },
    })

    const response = await GET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockRunOneMinuteTasks).toHaveBeenCalledTimes(1)
  })
})
