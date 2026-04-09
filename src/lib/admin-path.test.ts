import { afterEach, describe, expect, it, vi } from 'vitest'
import { _resetCacheForTest, getAdminPath, getPageReservedPrefixes } from './admin-path'

afterEach(() => {
  _resetCacheForTest()
  vi.unstubAllEnvs()
})

describe('getAdminPath', () => {
  it('ADMIN_PATH=rss.xml 应回退为 admin（保留路径）', () => {
    vi.stubEnv('ADMIN_PATH', 'rss.xml')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getAdminPath()).toBe('admin')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rss.xml'))
    warn.mockRestore()
  })

  it('ADMIN_PATH=foo( 应回退为 admin（非法字符）', () => {
    vi.stubEnv('ADMIN_PATH', 'foo(')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getAdminPath()).toBe('admin')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('foo('))
    warn.mockRestore()
  })

  it('ADMIN_PATH=backstage 应正常返回', () => {
    vi.stubEnv('ADMIN_PATH', 'backstage')
    expect(getAdminPath()).toBe('backstage')
  })
})

describe('getPageReservedPrefixes', () => {
  it('自定义后台路径应出现在保留前缀列表中', () => {
    vi.stubEnv('ADMIN_PATH', 'backstage')
    const prefixes = getPageReservedPrefixes()
    expect(prefixes).toContain('backstage')
    expect(prefixes).toContain('admin')
  })

  it('默认 admin 时不重复出现', () => {
    vi.stubEnv('ADMIN_PATH', 'admin')
    const prefixes = getPageReservedPrefixes()
    const count = prefixes.filter((p) => p === 'admin').length
    expect(count).toBe(1)
  })
})
