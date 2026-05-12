import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockExistsSync, mockReadFileSync, mockRealpathSync, mockRedirectResponseOrNotFound } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockRealpathSync: vi.fn(),
    mockRedirectResponseOrNotFound: vi.fn(),
  }))

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    realpathSync: mockRealpathSync,
  },
}))

const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads')

vi.mock('@/server/lib/frontend-404', () => ({
  redirectResponseOrNotFound: mockRedirectResponseOrNotFound,
}))

const uploadsRoute = await import('./route')

describe('src/app/uploads/[...path]/route', () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
    mockReadFileSync.mockReset()
    mockRealpathSync.mockReset()
    mockRedirectResponseOrNotFound.mockReset()
    // 默认 realpath 透传输入，模拟"无软链"的正常文件系统；
    // 涉及软链穿越的用例在内部覆盖该实现。
    mockRealpathSync.mockImplementation((p: string) => p)
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

  it('同前缀兄弟目录也不能绕过路径边界', async () => {
    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/../uploads_evil/secret.png') as any,
      {
        params: Promise.resolve({ path: ['..', 'uploads_evil', 'secret.png'] }),
      },
    )

    expect(response.status).toBe(403)
    expect(mockExistsSync).not.toHaveBeenCalled()
  })

  it('文件本身是指向上传目录外的符号链接时返回 403', async () => {
    mockExistsSync.mockReturnValue(true)
    // 模拟：上传目录下的文件被解析到目录外（攻击者在 uploads 中植入软链）
    mockRealpathSync.mockImplementation((p: string) => {
      if (p === UPLOAD_DIR) return UPLOAD_DIR
      return '/etc/passwd'
    })

    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/link.png') as any,
      {
        params: Promise.resolve({ path: ['link.png'] }),
      },
    )

    expect(response.status).toBe(403)
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })

  it('SVG 文件强制以附件下载并设置严格 CSP', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
    )

    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/img/evil.svg') as any,
      {
        params: Promise.resolve({ path: ['img', 'evil.svg'] }),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('evil.svg')
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('realpath 抛错（文件被并发删除等）返回 403', async () => {
    mockExistsSync.mockReturnValue(true)
    mockRealpathSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const response = await uploadsRoute.GET(
      new Request('http://localhost/uploads/img/photo.png') as any,
      {
        params: Promise.resolve({ path: ['img', 'photo.png'] }),
      },
    )

    expect(response.status).toBe(403)
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })
})
