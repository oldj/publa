import { afterEach, describe, expect, it, vi } from 'vitest'
import { _resetCacheForTest } from '@/lib/admin-path'
import { validatePagePath } from './pages'

afterEach(() => {
  _resetCacheForTest()
  vi.unstubAllEnvs()
})

describe('validatePagePath', () => {
  it('拒绝静态保留路径 admin', () => {
    expect(validatePagePath('admin')).toEqual({
      valid: false,
      code: 'RESERVED',
      values: { segment: 'admin' },
    })
  })

  it('拒绝静态保留路径 api', () => {
    expect(validatePagePath('api/foo')).toEqual({
      valid: false,
      code: 'RESERVED',
      values: { segment: 'api' },
    })
  })

  it('拒绝自定义后台路径', () => {
    vi.stubEnv('ADMIN_PATH', 'backstage')
    expect(validatePagePath('backstage')).toEqual({
      valid: false,
      code: 'RESERVED',
      values: { segment: 'backstage' },
    })
  })

  it('允许合法路径', () => {
    expect(validatePagePath('about')).toEqual({ valid: true })
  })
})
