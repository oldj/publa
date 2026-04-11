import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockHeaders, mockGetAllSettings } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockGetAllSettings: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

vi.mock('@/server/services/settings', () => ({
  getAllSettings: mockGetAllSettings,
}))

const { resolveLocale } = await import('./resolve-locale')

/** 构造 headers() 的返回值，根据 key 返回 map 中的值或 null */
function makeHeaders(map: Record<string, string>) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  }
}

describe('resolveLocale', () => {
  beforeEach(() => {
    mockHeaders.mockReset()
    mockGetAllSettings.mockReset()
  })

  it('优先使用数据库中的合法 language 设置', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ 'x-pathname': '/admin', 'accept-language': 'en-US,en;q=0.9' }),
    )
    mockGetAllSettings.mockResolvedValue({ language: 'zh' })

    await expect(resolveLocale()).resolves.toBe('zh')
  })

  it('数据库返回脏值时降级到 Accept-Language', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ 'x-pathname': '/admin', 'accept-language': 'en-US,en;q=0.9' }),
    )
    mockGetAllSettings.mockResolvedValue({ language: 'fr' })

    await expect(resolveLocale()).resolves.toBe('en')
  })

  it('数据库未初始化（抛错）时降级到 Accept-Language（zh）', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ 'x-pathname': '/admin', 'accept-language': 'zh-CN,zh;q=0.9' }),
    )
    mockGetAllSettings.mockRejectedValue(new Error('DB not ready'))

    await expect(resolveLocale()).resolves.toBe('zh')
  })

  it('数据库未初始化且 Accept-Language 为空时使用默认 locale', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/admin' }))
    mockGetAllSettings.mockRejectedValue(new Error('DB not ready'))

    await expect(resolveLocale()).resolves.toBe('en')
  })

  it('setup 页面的 ?lang= 合法值可以覆盖 DB 中的 language', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ 'x-pathname': '/setup', 'x-search': '?lang=en' }),
    )
    mockGetAllSettings.mockResolvedValue({ language: 'zh' })

    await expect(resolveLocale()).resolves.toBe('en')
  })

  it('setup 页面的 ?lang= 非法值不生效，继续读 DB', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({ 'x-pathname': '/setup', 'x-search': '?lang=fr' }),
    )
    mockGetAllSettings.mockResolvedValue({ language: 'zh' })

    await expect(resolveLocale()).resolves.toBe('zh')
  })

  it('非 setup 路径上的 ?lang= 不能覆盖 DB', async () => {
    mockHeaders.mockResolvedValue(
      makeHeaders({
        'x-pathname': '/admin/settings',
        'x-search': '?lang=en',
        'accept-language': 'en-US',
      }),
    )
    mockGetAllSettings.mockResolvedValue({ language: 'zh' })

    await expect(resolveLocale()).resolves.toBe('zh')
  })

  it('setup 页面无 ?lang= 参数时回落到 DB 设置', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/setup', 'x-search': '' }))
    mockGetAllSettings.mockResolvedValue({ language: 'en' })

    await expect(resolveLocale()).resolves.toBe('en')
  })
})
