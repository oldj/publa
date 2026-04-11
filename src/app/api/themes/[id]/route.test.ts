import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequireRole, mockDeleteTheme, mockUpdateTheme, mockLogActivity } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockDeleteTheme: vi.fn(),
  mockUpdateTheme: vi.fn(),
  mockLogActivity: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  requireRole: mockRequireRole,
}))

vi.mock('@/server/services/activity-logs', () => ({
  logActivity: mockLogActivity,
}))

vi.mock('@/server/services/themes', () => {
  class BuiltinThemeError extends Error {
    constructor(message = '内置主题不可修改或删除') {
      super(message)
      this.name = 'BuiltinThemeError'
    }
  }
  class ActiveThemeError extends Error {
    constructor(message = '无法删除当前正在使用的主题') {
      super(message)
      this.name = 'ActiveThemeError'
    }
  }
  return {
    ActiveThemeError,
    BuiltinThemeError,
    deleteTheme: mockDeleteTheme,
    updateTheme: mockUpdateTheme,
  }
})

const { DELETE, PUT } = await import('./route')
const { ActiveThemeError, BuiltinThemeError } = await import('@/server/services/themes')

function makeRequest(method = 'DELETE', body?: unknown) {
  return new NextRequest('http://localhost/api/themes/5', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function params(id: string) {
  return Promise.resolve({ id })
}

beforeEach(() => {
  mockRequireRole.mockReset()
  mockDeleteTheme.mockReset()
  mockUpdateTheme.mockReset()
  mockLogActivity.mockReset()

  mockRequireRole.mockResolvedValue({
    ok: true,
    user: { id: 1, username: 'admin', role: 'owner' },
  })
  mockLogActivity.mockResolvedValue(undefined)
})

describe('DELETE /api/themes/[id]', () => {
  it('未登录返回 401', async () => {
    mockRequireRole.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 },
      ),
    })

    const res = await DELETE(makeRequest(), { params: params('5') })
    expect(res.status).toBe(401)
    expect(mockDeleteTheme).not.toHaveBeenCalled()
  })

  it('删除成功返回 { success: true }', async () => {
    mockDeleteTheme.mockResolvedValueOnce({ success: true })

    const res = await DELETE(makeRequest(), { params: params('5') })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDeleteTheme).toHaveBeenCalledWith(5)
    expect(mockLogActivity).toHaveBeenCalled()
  })

  it('主题不存在返回 404 / NOT_FOUND', async () => {
    mockDeleteTheme.mockResolvedValueOnce({ success: false, message: '主题不存在' })

    const res = await DELETE(makeRequest(), { params: params('5') })
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })

  it('删除内置主题返回 400 / BUILTIN_THEME', async () => {
    mockDeleteTheme.mockRejectedValueOnce(new BuiltinThemeError())

    const res = await DELETE(makeRequest(), { params: params('5') })
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.code).toBe('BUILTIN_THEME')
  })

  it('删除生效主题返回 400 / ACTIVE_THEME', async () => {
    mockDeleteTheme.mockRejectedValueOnce(new ActiveThemeError())

    const res = await DELETE(makeRequest(), { params: params('5') })
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.code).toBe('ACTIVE_THEME')
    expect(mockLogActivity).not.toHaveBeenCalled()
  })
})

describe('PUT /api/themes/[id]', () => {
  it('更新成功返回新记录', async () => {
    mockUpdateTheme.mockResolvedValueOnce({
      id: 5,
      name: '新名',
      css: 'a{}',
      sortOrder: 1,
      builtinKey: null,
    })

    const res = await PUT(makeRequest('PUT', { name: '新名', css: 'a{}' }), {
      params: params('5'),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('新名')
  })

  it('主题不存在返回 404', async () => {
    mockUpdateTheme.mockResolvedValueOnce(null)
    const res = await PUT(makeRequest('PUT', { name: 'x' }), { params: params('5') })
    expect(res.status).toBe(404)
  })

  it('内置主题返回 400 / BUILTIN_THEME', async () => {
    mockUpdateTheme.mockRejectedValueOnce(new BuiltinThemeError())
    const res = await PUT(makeRequest('PUT', { name: 'x' }), { params: params('5') })
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.code).toBe('BUILTIN_THEME')
  })
})
