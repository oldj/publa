import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRequireCurrentUser,
  mockRequireRole,
  mockListMenus,
  mockListCategories,
  mockListTags,
} = vi.hoisted(() => ({
  mockRequireCurrentUser: vi.fn(),
  mockRequireRole: vi.fn(),
  mockListMenus: vi.fn(),
  mockListCategories: vi.fn(),
  mockListTags: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireCurrentUser: mockRequireCurrentUser,
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/menus', () => ({
  listMenus: mockListMenus,
  createMenu: vi.fn(),
  reorderMenus: vi.fn(),
  resetMenus: vi.fn(),
}))

vi.mock('@/server/services/categories', () => ({
  listCategories: mockListCategories,
  createCategory: vi.fn(),
  getCategoryBySlug: vi.fn(),
}))

vi.mock('@/server/services/tags', () => ({
  listTags: mockListTags,
  createTag: vi.fn(),
  getTagBySlug: vi.fn(),
}))

const menusRoute = await import('./menus/route')
const categoriesRoute = await import('./categories/route')
const tagsRoute = await import('./tags/route')
const importExportFormatRoute = await import('./import-export/format/route')

const unauthorizedResponse = () => ({
  ok: false,
  response: NextResponse.json(
    { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
    { status: 401 },
  ),
})

describe('后台只读接口访问控制', () => {
  beforeEach(() => {
    mockRequireCurrentUser.mockReset()
    mockRequireRole.mockReset()
    mockListMenus.mockReset()
    mockListCategories.mockReset()
    mockListTags.mockReset()

    mockRequireCurrentUser.mockResolvedValue(unauthorizedResponse())
    mockRequireRole.mockResolvedValue(unauthorizedResponse())
  })

  it('未登录不能读取菜单列表', async () => {
    const response = await menusRoute.GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
    expect(mockListMenus).not.toHaveBeenCalled()
  })

  it('未登录不能读取分类列表', async () => {
    const response = await categoriesRoute.GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
    expect(mockListCategories).not.toHaveBeenCalled()
  })

  it('未登录不能读取标签列表', async () => {
    const response = await tagsRoute.GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
    expect(mockListTags).not.toHaveBeenCalled()
  })

  it('未登录不能读取导入导出格式文档', async () => {
    const response = await importExportFormatRoute.GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
  })
})
