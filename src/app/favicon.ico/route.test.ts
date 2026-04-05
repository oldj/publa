import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockResolveFaviconAsset } = vi.hoisted(() => ({
  mockResolveFaviconAsset: vi.fn(),
}))

vi.mock('@/server/services/favicon', () => ({
  resolveFaviconAsset: mockResolveFaviconAsset,
}))

const { GET } = await import('./route')

describe('/favicon.ico', () => {
  beforeEach(() => {
    mockResolveFaviconAsset.mockReset()
  })

  it('版本化请求返回二进制图标并使用长缓存', async () => {
    mockResolveFaviconAsset.mockResolvedValue({
      kind: 'binary',
      body: Buffer.from('icon-data'),
      contentType: 'image/png',
      etag: '"etag-1"',
    })

    const response = await GET(new Request('http://localhost/favicon.ico?v=abc123') as any)
    const body = Buffer.from(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(body.equals(Buffer.from('icon-data'))).toBe(true)
  })

  it('未带版本时命中 ETag 返回 304', async () => {
    mockResolveFaviconAsset.mockResolvedValue({
      kind: 'binary',
      body: Buffer.from('icon-data'),
      contentType: 'image/png',
      etag: '"etag-1"',
    })

    const response = await GET(
      new Request('http://localhost/favicon.ico', {
        headers: { 'if-none-match': '"etag-1"' },
      }) as any,
    )

    expect(response.status).toBe(304)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })

  it('URL 模式返回 307 重定向', async () => {
    mockResolveFaviconAsset.mockResolvedValue({
      kind: 'redirect',
      location: 'https://cdn.example.com/favicon.png',
      etag: '"etag-2"',
    })

    const response = await GET(new Request('http://localhost/favicon.ico') as any)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('https://cdn.example.com/favicon.png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  })
})
