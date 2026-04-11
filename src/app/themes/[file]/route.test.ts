import * as schema from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { _resetBuiltinThemeCache } from '@/server/services/builtin-themes'

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

const { GET } = await import('./route')
const { setSetting } = await import('@/server/services/settings')

function req(pathname: string): any {
  const url = new URL(`http://localhost${pathname}`)
  return {
    nextUrl: url,
    url: url.toString(),
  }
}

async function params(file: string) {
  return Promise.resolve({ file })
}

beforeEach(async () => {
  await setupTestDb()
  mockGetCurrentUser.mockReset()
  mockGetCurrentUser.mockResolvedValue(null)

  // 预置内置主题。id 由 DB 自增分配，测试通过 builtinKey 反查，避免对具体 id 产生隐式依赖，
  // 这样未来新增或重排内置主题（例如在 blank 之前加一个 blue）都不需要改本文件
  await testDb.insert(schema.themes).values([
    { name: '浅色', css: '', sortOrder: 1, builtinKey: 'light' },
    { name: '深色', css: '', sortOrder: 2, builtinKey: 'dark' },
    { name: '空白', css: '', sortOrder: 3, builtinKey: 'blank' },
  ])

  // 每个测试独立重置 builtin id→key 模块缓存（setupTestDb 已做，这里显式再强调一次）
  _resetBuiltinThemeCache()
})

async function builtinId(key: 'light' | 'dark' | 'blank'): Promise<number> {
  const rows = await testDb
    .select({ id: schema.themes.id })
    .from(schema.themes)
    .where(eq(schema.themes.builtinKey, key))
    .limit(1)
  if (rows.length === 0) throw new Error(`builtin theme not found: ${key}`)
  return rows[0].id
}

describe('GET /themes/theme.css', () => {
  it('activeThemeId 为空时返回空字符串', async () => {
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('active 指向内置 light 时 302 重定向到 /themes/light.css', async () => {
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/light\.css$/)
  })

  it('active 指向内置 dark 时 302 重定向到 /themes/dark.css', async () => {
    await setSetting('activeThemeId', await builtinId('dark'))
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/dark\.css$/)
  })

  it('active 指向内置 blank 时返回空字符串', async () => {
    await setSetting('activeThemeId', await builtinId('blank'))
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('active 指向自定义主题时返回该主题的 css 字段', async () => {
    await testDb.insert(schema.themes).values({
      id: 100,
      name: '自定义',
      css: '.mine { color: red; }',
      sortOrder: 10,
      builtinKey: null,
    })
    await setSetting('activeThemeId', 100)
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(await res.text()).toBe('.mine { color: red; }')
  })

  it('active 指向不存在主题时返回空字符串（不做兜底）', async () => {
    await setSetting('activeThemeId', 99999)
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(await res.text()).toBe('')
  })

  it('未登录用户的 preview 参数被忽略，仍然按 active 返回', async () => {
    await testDb.insert(schema.themes).values({
      id: 200,
      name: '预览主题',
      css: '.preview{}',
      sortOrder: 20,
      builtinKey: null,
    })
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css?preview=200'), { params: params('theme.css') })
    // 被忽略后按 active=light 走 302
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/light\.css$/)
  })

  it('已登录用户预览自定义主题时返回该主题的 css', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await testDb.insert(schema.themes).values({
      id: 200,
      name: '预览主题',
      css: '.preview{}',
      sortOrder: 20,
      builtinKey: null,
    })
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css?preview=200'), { params: params('theme.css') })
    expect(await res.text()).toBe('.preview{}')
  })

  it('已登录用户预览内置 dark 时 302 到 /themes/dark.css（preview 参数使用 key）', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css?preview=dark'), { params: params('theme.css') })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/dark\.css$/)
  })

  it('已登录用户预览内置 light 时 302 到 /themes/light.css（preview 参数使用 key）', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeThemeId', await builtinId('dark'))
    const res = await GET(req('/themes/theme.css?preview=light'), { params: params('theme.css') })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/light\.css$/)
  })

  it('已登录用户预览内置 blank 时返回空字符串而非 302', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css?preview=blank'), { params: params('theme.css') })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('向后兼容：已登录用户仍可用数字 id 预览内置主题', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeThemeId', await builtinId('light'))
    const darkId = await builtinId('dark')
    const res = await GET(req(`/themes/theme.css?preview=${darkId}`), { params: params('theme.css') })
    // 数字 id 命中 builtin 后同样被识别为内置并 302
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/dark\.css$/)
  })

  it('无效 preview 字符串被忽略，仍按 active 返回', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeThemeId', await builtinId('light'))
    const res = await GET(req('/themes/theme.css?preview=bogus'), { params: params('theme.css') })
    // 字符串不匹配任何 builtin key，Number('bogus') 为 NaN，回退到 active
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/\/themes\/light\.css$/)
  })
})

describe('GET /themes/custom.css', () => {
  beforeEach(async () => {
    await testDb.insert(schema.customStyles).values([
      { id: 10, name: '片段A', css: '.a{color:red}', sortOrder: 1 },
      { id: 11, name: '片段B', css: '.b{color:blue}', sortOrder: 2 },
      { id: 12, name: '片段C', css: '.c{color:green}', sortOrder: 3 },
    ])
  })

  it('无选中时返回空字符串', async () => {
    const res = await GET(req('/themes/custom.css'), { params: params('custom.css') })
    expect(await res.text()).toBe('')
  })

  it('按 activeCustomStyleIds 顺序拼接', async () => {
    await setSetting('activeCustomStyleIds', [11, 10])
    const res = await GET(req('/themes/custom.css'), { params: params('custom.css') })
    const text = await res.text()
    // 按 [11, 10] 的顺序输出
    const indexB = text.indexOf('片段B')
    const indexA = text.indexOf('片段A')
    expect(indexB).toBeGreaterThanOrEqual(0)
    expect(indexA).toBeGreaterThan(indexB)
    expect(text).toContain('.b{color:blue}')
    expect(text).toContain('.a{color:red}')
    // 不包含未选中的片段 C
    expect(text).not.toContain('.c{color:green}')
  })

  it('未登录用户 preview 参数被忽略', async () => {
    await setSetting('activeCustomStyleIds', [10])
    const res = await GET(req('/themes/custom.css?preview=11,12'), {
      params: params('custom.css'),
    })
    const text = await res.text()
    expect(text).toContain('.a{color:red}')
    expect(text).not.toContain('.b{color:blue}')
  })

  it('已登录用户的 preview 参数按指定列表拼接', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await setSetting('activeCustomStyleIds', [10])
    const res = await GET(req('/themes/custom.css?preview=12,11'), {
      params: params('custom.css'),
    })
    const text = await res.text()
    // 预览顺序为 12, 11
    expect(text).toContain('.c{color:green}')
    expect(text).toContain('.b{color:blue}')
    expect(text.indexOf('片段C')).toBeLessThan(text.indexOf('片段B'))
    expect(text).not.toContain('.a{color:red}')
  })
})

describe('GET 其它 CSS 文件', () => {
  it('未知文件名返回 404', async () => {
    const res = await GET(req('/themes/unknown.css'), { params: params('unknown.css') })
    expect(res.status).toBe(404)
  })
})
