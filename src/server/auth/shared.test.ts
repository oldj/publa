import { afterEach, describe, expect, it } from 'vitest'
import { getJwtSecret } from './shared'

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
