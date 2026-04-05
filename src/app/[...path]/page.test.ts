import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetPublishedPageByPath, mockRedirectOrNotFound, mockNotFound } = vi.hoisted(() => ({
  mockGetPublishedPageByPath: vi.fn(),
  mockRedirectOrNotFound: vi.fn(),
  mockNotFound: vi.fn(),
}))

vi.mock('@/server/services/pages', () => ({
  getPublishedPageByPath: mockGetPublishedPageByPath,
}))

vi.mock('@/server/lib/frontend-404', () => ({
  redirectOrNotFound: mockRedirectOrNotFound,
}))

vi.mock('@/layouts/basic', () => ({
  default: ({ children }: { children: unknown }) => children,
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}))

const { default: DynamicPage } = await import('./page')

describe('src/app/[...path]/page', () => {
  beforeEach(() => {
    mockGetPublishedPageByPath.mockReset()
    mockRedirectOrNotFound.mockReset()
    mockNotFound.mockReset()
  })

  it('完全不存在的路径会先尝试跳转规则', async () => {
    mockGetPublishedPageByPath.mockResolvedValue(null)
    mockRedirectOrNotFound.mockRejectedValue(new Error('REDIRECT'))

    await expect(
      DynamicPage({
        params: Promise.resolve({ path: ['old', 'path', '123'] }),
      }),
    ).rejects.toThrow('REDIRECT')

    expect(mockRedirectOrNotFound).toHaveBeenCalledWith('/old/path/123')
  })

  it('保留路径直接返回 404', async () => {
    mockNotFound.mockImplementation(() => {
      throw new Error('NOT_FOUND')
    })

    await expect(
      DynamicPage({
        params: Promise.resolve({ path: ['admin', 'settings'] }),
      }),
    ).rejects.toThrow('NOT_FOUND')

    expect(mockRedirectOrNotFound).not.toHaveBeenCalled()
  })
})
