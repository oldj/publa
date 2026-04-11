import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'

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
  }
}

async function params(file: string) {
  return Promise.resolve({ file })
}

beforeEach(async () => {
  await setupTestDb()
  mockGetCurrentUser.mockReset()
  mockGetCurrentUser.mockResolvedValue(null)

  // 预置内置主题
  await testDb.insert(schema.themes).values([
    { id: 1, name: '浅色', css: '', sortOrder: 1, builtinKey: 'light' },
    { id: 2, name: '深色', css: '', sortOrder: 2, builtinKey: 'dark' },
    { id: 3, name: '空白', css: '', sortOrder: 3, builtinKey: 'blank' },
  ])
})

describe('GET /themes/light.css 与 /themes/dark.css', () => {
  it('返回内置 light.css 文件内容', async () => {
    const res = await GET(req('/themes/light.css'), { params: params('light.css') })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/css')
    const text = await res.text()
    // light.css 文件真实存在，应包含至少一条 CSS 规则
    expect(text.length).toBeGreaterThan(0)
  })

  it('返回内置 dark.css 文件内容', async () => {
    const res = await GET(req('/themes/dark.css'), { params: params('dark.css') })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text.length).toBeGreaterThan(0)
  })
})

describe('GET /themes/theme.css', () => {
  it('activeThemeId 为空时返回空字符串', async () => {
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('active 指向内置 light 时返回 light.css 内容', async () => {
    await setSetting('activeThemeId', 1)
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
    const text = await res.text()
    expect(text.length).toBeGreaterThan(0)
  })

  it('active 指向内置 blank 时返回空字符串', async () => {
    await setSetting('activeThemeId', 3)
    const res = await GET(req('/themes/theme.css'), { params: params('theme.css') })
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
    await setSetting('activeThemeId', 1) // light
    const res = await GET(req('/themes/theme.css?preview=200'), { params: params('theme.css') })
    const text = await res.text()
    // 应当是 light.css 的内容，不是 .preview{}
    expect(text).not.toBe('.preview{}')
    expect(text.length).toBeGreaterThan(0)
  })

  it('已登录用户的 preview 参数生效', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'admin' })
    await testDb.insert(schema.themes).values({
      id: 200,
      name: '预览主题',
      css: '.preview{}',
      sortOrder: 20,
      builtinKey: null,
    })
    await setSetting('activeThemeId', 1)
    const res = await GET(req('/themes/theme.css?preview=200'), { params: params('theme.css') })
    expect(await res.text()).toBe('.preview{}')
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
