import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/server/db/schema'
import { setupTestDb, testDb } from './__test__/setup'

const mockSendEmail = vi.fn()

vi.mock('@/server/services/email-sender', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}))

const { notifyNewComment, notifyNewGuestbook } = await import('./notifications')
const { listEmailLogs } = await import('./email-logs')

async function setSetting(key: string, value: string) {
  const existing = await testDb
    .select()
    .from(schema.settings)
    .where((await import('drizzle-orm')).eq(schema.settings.key, key))
  if (existing.length > 0) {
    await testDb
      .update(schema.settings)
      .set({ value })
      .where((await import('drizzle-orm')).eq(schema.settings.key, key))
  } else {
    await testDb.insert(schema.settings).values({ key, value })
  }
}

async function setUserEmail(userId: number, email: string | null) {
  await testDb
    .update(schema.users)
    .set({ email })
    .where((await import('drizzle-orm')).eq(schema.users.id, userId))
}

/** 创建一篇用于评论通知测试的文章 */
async function createTestPost() {
  const [post] = await testDb
    .insert(schema.contents)
    .values({
      type: 'post',
      title: '测试文章标题',
      slug: 'test-post',
      authorId: 1,
      contentRaw: '# Test',
      contentHtml: '<h1>Test</h1>',
      contentText: 'Test',
      status: 'published',
      publishedAt: new Date().toISOString(),
    })
    .returning()
  return post
}

beforeEach(async () => {
  await setupTestDb()
  mockSendEmail.mockReset()
  mockSendEmail.mockResolvedValue({ success: true })
})

describe('notifyNewComment', () => {
  it('开启通知并指定有邮箱的用户时，发送邮件并记录日志', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: true, userIds: [1] }))
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '好文章！',
      contentId: post.id,
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [recipients, subject, html] = mockSendEmail.mock.calls[0]
    expect(recipients).toEqual(['admin@test.com'])
    expect(subject).toContain('测试文章标题')
    expect(html).toContain('访客')
    expect(html).toContain('好文章！')
    expect(html).toContain('https://example.com/admin/comments')

    // 验证日志已记录
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(1)
    expect(logs.items[0].eventType).toBe('new_comment')
    expect(logs.items[0].status).toBe('success')
  })

  it('未设置通知配置时不发送邮件', async () => {
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(0)
  })

  it('通知未开启（enabled: false）时不发送邮件', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: false, userIds: [1] }))
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('指定的用户没有邮箱时不发送邮件', async () => {
    // setupTestDb 创建的用户默认没有 email
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: true, userIds: [1, 2] }))
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(0)
  })

  it('多用户中仅向有邮箱的用户发送', async () => {
    await setUserEmail(1, 'admin@test.com')
    // user 2 没有 email
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: true, userIds: [1, 2] }))
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [recipients] = mockSendEmail.mock.calls[0]
    expect(recipients).toEqual(['admin@test.com'])
  })

  it('发送失败时日志记录 fail 状态', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'Connection refused' })
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: true, userIds: [1] }))
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
    })

    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.items[0].status).toBe('fail')
    expect(logs.items[0].errorMessage).toBe('Connection refused')
  })

  it('评论内容中的 HTML 被转义', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', JSON.stringify({ enabled: true, userIds: [1] }))
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '<script>alert(1)</script>',
      content: '<img onerror="hack">',
      contentId: post.id,
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('notifyNewGuestbook', () => {
  it('开启通知时发送邮件', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewGuestbook', JSON.stringify({ enabled: true, userIds: [1] }))
    await setSetting('siteUrl', 'https://example.com')

    await notifyNewGuestbook({
      authorName: '游客',
      content: '你好',
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [recipients, subject, html] = mockSendEmail.mock.calls[0]
    expect(recipients).toEqual(['admin@test.com'])
    expect(subject).toContain('游客')
    expect(html).toContain('你好')
    expect(html).toContain('https://example.com/admin/guestbook')

    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.items[0].eventType).toBe('new_guestbook')
  })

  it('未配置时不发送', async () => {
    await notifyNewGuestbook({ authorName: '游客', content: '你好' })

    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
