import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetTagBySlug, mockRedirectOrNotFound } = vi.hoisted(() => ({
  mockGetTagBySlug: vi.fn(),
  mockRedirectOrNotFound: vi.fn(),
}))

vi.mock('@/server/services/tags', () => ({
  getTagBySlug: mockGetTagBySlug,
}))

vi.mock('@/server/lib/frontend-404', () => ({
  redirectOrNotFound: mockRedirectOrNotFound,
}))

vi.mock('@/components/post-list-page', () => ({
  default: () => null,
}))

vi.mock('@/layouts/basic', () => ({
  default: ({ children }: { children: unknown }) => children,
}))

const { default: TagPage } = await import('./page')

describe('src/app/tag/[slug]/page', () => {
  beforeEach(() => {
    mockGetTagBySlug.mockReset()
    mockRedirectOrNotFound.mockReset()
  })

  it('标签不存在时会先尝试跳转规则', async () => {
    mockGetTagBySlug.mockResolvedValue(null)
    mockRedirectOrNotFound.mockRejectedValue(new Error('REDIRECT'))

    await expect(
      TagPage({
        params: Promise.resolve({ slug: 'missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('REDIRECT')

    expect(mockRedirectOrNotFound).toHaveBeenCalledWith('/tag/missing')
  })
})
