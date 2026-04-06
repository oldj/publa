import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetCurrentUser,
  mockGetFrontendPostBySlug,
  mockRedirectOrNotFound,
  mockMaybeFirst,
  mockRedirect,
  mockNotFound,
  mockGetSetting,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetFrontendPostBySlug: vi.fn(),
  mockRedirectOrNotFound: vi.fn(),
  mockMaybeFirst: vi.fn(),
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockGetSetting: vi.fn(),
}))

const queryChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}
queryChain.from.mockReturnValue(queryChain)
queryChain.innerJoin.mockReturnValue(queryChain)
queryChain.where.mockReturnValue(queryChain)
queryChain.limit.mockResolvedValue([])

vi.mock('@/server/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

vi.mock('@/server/services/posts-frontend', () => ({
  getFrontendPostBySlug: mockGetFrontendPostBySlug,
}))

vi.mock('@/server/services/settings', () => ({
  getSetting: mockGetSetting,
}))

vi.mock('@/server/services/preview', () => ({
  parsePreviewId: vi.fn(() => null),
  getPreviewPost: vi.fn(),
}))

vi.mock('@/server/lib/frontend-404', () => ({
  redirectOrNotFound: mockRedirectOrNotFound,
}))

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(() => queryChain),
  },
}))

vi.mock('@/server/db/query', () => ({
  maybeFirst: mockMaybeFirst,
}))

vi.mock('@/server/db/schema', () => ({
  slugHistories: { slug: 'slug', contentId: 'contentId' },
  contents: { id: 'id', slug: 'slug', deletedAt: 'deletedAt' },
}))

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm')
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    and: vi.fn(() => 'and'),
    isNull: vi.fn(() => 'isNull'),
  }
})

vi.mock('@/app/posts/[...slug]/components/Post', () => ({
  default: () => null,
}))

vi.mock('@/layouts/basic', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/getHeadersFromHTML', () => ({
  default: vi.fn(() => ({ html: '', headers: [] })),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}))

const { default: PostPage } = await import('./page')

describe('src/app/posts/[...slug]/page', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockGetFrontendPostBySlug.mockReset()
    mockRedirectOrNotFound.mockReset()
    mockMaybeFirst.mockReset()
    mockRedirect.mockReset()
    mockNotFound.mockReset()
    queryChain.from.mockClear()
    queryChain.innerJoin.mockClear()
    queryChain.where.mockClear()
    queryChain.limit.mockClear()

    mockGetCurrentUser.mockResolvedValue(null)
    mockGetFrontendPostBySlug.mockResolvedValue(null)
    mockMaybeFirst.mockResolvedValue(null)
    mockGetSetting.mockResolvedValue(null)
  })

  it('文章 miss 且没有 slug 历史时会尝试跳转规则', async () => {
    mockRedirectOrNotFound.mockRejectedValue(new Error('REDIRECT_RULE'))

    await expect(
      PostPage({
        params: Promise.resolve({ slug: ['missing-post'] }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('REDIRECT_RULE')

    expect(mockRedirectOrNotFound).toHaveBeenCalledWith('/posts/missing-post')
  })

  it('文章 miss 但命中 slug 历史时优先走历史跳转', async () => {
    mockMaybeFirst.mockResolvedValue({ slug: 'current-post' })
    mockRedirect.mockImplementation(() => {
      throw new Error('SLUG_HISTORY_REDIRECT')
    })

    await expect(
      PostPage({
        params: Promise.resolve({ slug: ['old-post'] }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('SLUG_HISTORY_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/posts/current-post')
    expect(mockRedirectOrNotFound).not.toHaveBeenCalled()
  })
})
