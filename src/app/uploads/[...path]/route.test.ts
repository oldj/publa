import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExistsSync, mockReadFileSync, mockRedirectResponseOrNotFound } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockRedirectResponseOrNotFound: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
}))

vi.mock('@/server/lib/frontend-404', () => ({
  redirectResponseOrNotFound: mockRedirectResponseOrNotFound,
}))

const uploadsRoute = await import('./route')

describe('src/app/uploads/[...path]/route', () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
    mockReadFileSync.mockReset()
    mockRedirectResponseOrNotFound.mockReset()
  })

  it('上传文件不存在时会先尝试跳转规则', async () => {
    mockExistsSync.mockReturnValue(false)
    mockRedirectResponseOrNotFound.mockResolvedValue(new Response(null, { status: 308 }))

    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/missing') as any,
      {
        params: Promise.resolve({ path: ['legacy', 'missing.png'] }),
      },
    )

    expect(response.status).toBe(308)
    expect(mockRedirectResponseOrNotFound).toHaveBeenCalledWith(
      '/uploads/legacy/missing.png',
      expect.any(Request),
    )
  })

  it('文件存在时返回正确的 Content-Type 和缓存头', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(Buffer.from('fake-png'))

    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/img/photo.png') as any,
      {
        params: Promise.resolve({ path: ['img', 'photo.png'] }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
  })

  it('路径遍历攻击返回 403', async () => {
    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/../../etc/passwd') as any,
      {
        params: Promise.resolve({ path: ['..', '..', 'etc', 'passwd'] }),
      },
    )

    expect(response.status).toBe(403)
    expect(mockExistsSync).not.toHaveBeenCalled()
  })
})
