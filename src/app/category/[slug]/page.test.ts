import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetCategoryBySlug, mockRedirectOrNotFound } = vi.hoisted(() => ({
  mockGetCategoryBySlug: vi.fn(),
  mockRedirectOrNotFound: vi.fn(),
}))

vi.mock('@/server/services/categories', () => ({
  getCategoryBySlug: mockGetCategoryBySlug,
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

const { default: CategoryPage } = await import('./page')

describe('src/app/category/[slug]/page', () => {
  beforeEach(() => {
    mockGetCategoryBySlug.mockReset()
    mockRedirectOrNotFound.mockReset()
  })

  it('分类不存在时会先尝试跳转规则', async () => {
    mockGetCategoryBySlug.mockResolvedValue(null)
    mockRedirectOrNotFound.mockRejectedValue(new Error('REDIRECT'))

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: 'missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('REDIRECT')

    expect(mockRedirectOrNotFound).toHaveBeenCalledWith('/category/missing')
  })
})
