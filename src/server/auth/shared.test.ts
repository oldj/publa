import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJwtSecret, initJwtSecret } from './shared'

vi.mock('@/server/services/settings', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

describe('getJwtSecret', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('生产环境缺少 JWT_SECRET 时会失败关闭', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    delete process.env.JWT_SECRET

    expect(() => getJwtSecret()).toThrow('JWT_SECRET is not configured')
  })

  it('测试环境允许使用默认密钥', () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    delete process.env.JWT_SECRET

    expect(getJwtSecret()).toBeInstanceOf(Uint8Array)
  })
})

describe('initJwtSecret', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('环境变量已配置时跳过数据库访问', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production', JWT_SECRET: 'my-custom-secret' }

    const { getSetting } = await import('@/server/services/settings')
    await initJwtSecret()

    expect(getSetting).not.toHaveBeenCalled()
    expect(process.env.JWT_SECRET).toBe('my-custom-secret')
  })

  it('非生产环境时跳过数据库访问', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    delete process.env.JWT_SECRET

    const { getSetting } = await import('@/server/services/settings')
    await initJwtSecret()

    expect(getSetting).not.toHaveBeenCalled()
  })

  it('生产环境从数据库加载已有 secret', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    delete process.env.JWT_SECRET

    const { getSetting } = await import('@/server/services/settings')
    vi.mocked(getSetting).mockResolvedValue('stored-secret-from-db')

    await initJwtSecret()

    expect(getSetting).toHaveBeenCalledWith('jwtSecret')
    expect(process.env.JWT_SECRET).toBe('stored-secret-from-db')
  })

  it('环境变量为默认值时视为未配置，走数据库逻辑', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'blog-jwt-secret-change-me',
    }

    const { getSetting } = await import('@/server/services/settings')
    vi.mocked(getSetting).mockResolvedValue('secret-from-db')

    await initJwtSecret()

    expect(getSetting).toHaveBeenCalledWith('jwtSecret')
    expect(process.env.JWT_SECRET).toBe('secret-from-db')
  })

  it('生产环境自动生成并保存到数据库', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    delete process.env.JWT_SECRET

    const { getSetting, setSetting } = await import('@/server/services/settings')
    vi.mocked(getSetting).mockResolvedValue(null)

    await initJwtSecret()

    expect(setSetting).toHaveBeenCalledWith('jwtSecret', expect.any(String))
    // 验证生成的 secret 非空且长度合理（base64url 编码的 32 字节 = 43 字符）
    const savedValue = vi.mocked(setSetting).mock.calls[0][1] as string
    expect(savedValue.length).toBeGreaterThanOrEqual(40)
    expect(process.env.JWT_SECRET).toBe(savedValue)
  })

  it('初始化后 getJwtSecret 在生产环境正常工作', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    delete process.env.JWT_SECRET

    const { getSetting } = await import('@/server/services/settings')
    vi.mocked(getSetting).mockResolvedValue('db-secret')

    await initJwtSecret()

    const secret = getJwtSecret()
    expect(secret).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(secret)).toBe('db-secret')
  })
})
