import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockPublishScheduledPosts,
  mockPublishScheduledPages,
  mockCleanExpiredCaptchas,
  mockCleanExpiredRateEvents,
} = vi.hoisted(() => ({
  mockPublishScheduledPosts: vi.fn(),
  mockPublishScheduledPages: vi.fn(),
  mockCleanExpiredCaptchas: vi.fn(),
  mockCleanExpiredRateEvents: vi.fn(),
}))

vi.mock('@/server/services/posts', () => ({
  publishScheduledPosts: mockPublishScheduledPosts,
}))

vi.mock('@/server/services/pages', () => ({
  publishScheduledPages: mockPublishScheduledPages,
}))

vi.mock('@/server/lib/captcha', () => ({
  cleanExpiredCaptchas: mockCleanExpiredCaptchas,
}))

vi.mock('@/server/lib/rate-limit', () => ({
  cleanExpiredRateEvents: mockCleanExpiredRateEvents,
}))

const { runOneMinuteTasks } = await import('./1m')

describe('runOneMinuteTasks', () => {
  beforeEach(() => {
    mockPublishScheduledPosts.mockReset()
    mockPublishScheduledPages.mockReset()
    mockCleanExpiredCaptchas.mockReset()
    mockCleanExpiredRateEvents.mockReset()
  })

  it('执行所有定时任务函数', async () => {
    await runOneMinuteTasks()

    expect(mockPublishScheduledPosts).toHaveBeenCalledTimes(1)
    expect(mockPublishScheduledPages).toHaveBeenCalledTimes(1)
    expect(mockCleanExpiredCaptchas).toHaveBeenCalledTimes(1)
    expect(mockCleanExpiredRateEvents).toHaveBeenCalledTimes(1)
  })

  it('按顺序执行任务', async () => {
    const order: string[] = []
    mockPublishScheduledPosts.mockImplementation(() => { order.push('posts') })
    mockPublishScheduledPages.mockImplementation(() => { order.push('pages') })
    mockCleanExpiredCaptchas.mockImplementation(() => { order.push('captchas') })
    mockCleanExpiredRateEvents.mockImplementation(() => { order.push('rateEvents') })

    await runOneMinuteTasks()

    expect(order).toEqual(['posts', 'pages', 'captchas', 'rateEvents'])
  })
})
