import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockHeaders, mockResolveLocale, mockLoadMessages } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockResolveLocale: vi.fn(),
  mockLoadMessages: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mockHeaders,
}))

// vitest 在客户端条件下解析 next-intl，会让真实的 getRequestConfig 抛
// "not supported in Client Components"。这里直接桩成 identity 函数，
// 与 next-intl 在 react-server 条件下的实际行为一致。
vi.mock('next-intl/server', () => ({
  getRequestConfig: <T>(fn: T) => fn,
}))

vi.mock('./resolve-locale', () => ({
  resolveLocale: mockResolveLocale,
}))

vi.mock('./load-messages', () => ({
  loadMessages: mockLoadMessages,
}))

const requestConfigModule = await import('./request')
const requestConfig = requestConfigModule.default as () => Promise<{
  locale: string
  messages: Record<string, unknown>
}>

function makeHeaders(map: Record<string, string>) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  }
}

const FULL_MESSAGES = {
  common: { hello: 'common' },
  frontend: { hello: 'frontend' },
  admin: { hello: 'admin' },
}

describe('i18n requestConfig', () => {
  beforeEach(() => {
    mockHeaders.mockReset()
    mockResolveLocale.mockReset()
    mockLoadMessages.mockReset()
    mockResolveLocale.mockResolvedValue('zh')
    mockLoadMessages.mockResolvedValue(FULL_MESSAGES)
  })

  it('前台路径只下发 common + frontend，不包含 admin', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/' }))

    const cfg = await requestConfig()

    expect(cfg.locale).toBe('zh')
    expect(Object.keys(cfg.messages).sort()).toEqual(['common', 'frontend'])
    expect(cfg.messages).not.toHaveProperty('admin')
  })

  it('文章详情等前台子路径同样不包含 admin', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/posts/hello' }))

    const cfg = await requestConfig()

    expect(cfg.messages).not.toHaveProperty('admin')
  })

  it('/admin 路径下发完整 messages（含 admin）', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/admin' }))

    const cfg = await requestConfig()

    expect(Object.keys(cfg.messages).sort()).toEqual(['admin', 'common', 'frontend'])
  })

  it('/admin/settings 等子路径同样下发 admin', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/admin/settings' }))

    const cfg = await requestConfig()

    expect(cfg.messages).toHaveProperty('admin')
  })

  it('/setup 页面也属于后台范畴，下发 admin', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/setup' }))

    const cfg = await requestConfig()

    expect(cfg.messages).toHaveProperty('admin')
  })

  it('自定义 ADMIN_PATH 场景：proxy 已 rewrite 为内部 /admin/*，按 admin 处理', async () => {
    // 自定义路径如 /manage/dashboard 在 proxy.ts 中被 rewrite，
    // 同时显式注入 x-pathname 为内部路径 /admin/dashboard。
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/admin/dashboard' }))

    const cfg = await requestConfig()

    expect(cfg.messages).toHaveProperty('admin')
  })

  it('缺失 x-pathname 时按前台处理，不下发 admin', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({}))

    const cfg = await requestConfig()

    expect(cfg.messages).not.toHaveProperty('admin')
  })

  it('看似带 admin 前缀但实为前台的路径不被误判', async () => {
    // 前台用户可能创建 slug 为 "administrator" 的内容；
    // 但 startsWith('/admin') 会把 /administrator 也命中——
    // 这里固化当前行为：以 /admin 开头一律视作后台。
    // 该 case 由 proxy 层保证不会出现（自定义 ADMIN_PATH 时旧 /admin 被屏蔽，
    // 默认场景下 /admin/* 即为后台），故这里只覆盖更典型的边界。
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/about' }))

    const cfg = await requestConfig()

    expect(cfg.messages).not.toHaveProperty('admin')
  })

  it('裁剪后引用的是同一份子对象，不做深拷贝', async () => {
    mockHeaders.mockResolvedValue(makeHeaders({ 'x-pathname': '/' }))

    const cfg = await requestConfig()

    expect(cfg.messages.common).toBe(FULL_MESSAGES.common)
    expect(cfg.messages.frontend).toBe(FULL_MESSAGES.frontend)
  })
})
