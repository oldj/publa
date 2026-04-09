import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSetting, mockRedirectOrNotFound } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockRedirectOrNotFound: vi.fn(),
}))

vi.mock('@/server/services/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/settings')>()),
  getSetting: mockGetSetting,
}))

vi.mock('@/server/lib/frontend-404', () => ({
  redirectOrNotFound: mockRedirectOrNotFound,
}))

vi.mock('@/components/feedback-form', () => ({
  default: () => null,
}))

vi.mock('@/layouts/basic', () => ({
  default: ({ children }: { children: unknown }) => children,
}))

const { default: GuestbookPage } = await import('./page')

describe('src/app/guestbook/page', () => {
  beforeEach(() => {
    mockGetSetting.mockReset()
    mockRedirectOrNotFound.mockReset()
  })

  it('留言板关闭时会先尝试跳转规则', async () => {
    mockGetSetting.mockResolvedValue(false)
    mockRedirectOrNotFound.mockRejectedValue(new Error('REDIRECT'))

    await expect(GuestbookPage()).rejects.toThrow('REDIRECT')

    expect(mockRedirectOrNotFound).toHaveBeenCalledWith('/guestbook')
  })
})
