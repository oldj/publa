import * as schema from '@/server/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const mockSendEmail = vi.fn()

vi.mock('@/server/services/email-sender', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
}))

const { notifyNewComment, notifyNewGuestbook } = await import('./notifications')
const { listEmailLogs } = await import('./email-logs')

async function setSetting(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  const { eq } = await import('drizzle-orm')
  const existing = await testDb.select().from(schema.settings).where(eq(schema.settings.key, key))
  if (existing.length > 0) {
    await testDb
      .update(schema.settings)
      .set({ value: serialized })
      .where(eq(schema.settings.key, key))
  } else {
    await testDb.insert(schema.settings).values({ key, value: serialized })
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
  it('站点语言为英文时使用英文通知模板', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'en')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'Visitor',
      content: 'Great post!',
      contentId: post.id,
      status: 'pending',
    })

    const [, subject, html] = mockSendEmail.mock.calls[0]
    expect(subject).toBe('New comment: 测试文章标题')
    expect(html).toContain('received a new comment')
    expect(html).toContain('View comment')
  })

  it('开启通知并指定有邮箱的用户时，发送邮件并记录日志', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '好文章！',
      contentId: post.id,
      status: 'pending',
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
      status: 'pending',
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(0)
  })

  it('通知未开启（enabled: false）时不发送邮件', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: false, userIds: [1] })
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('指定的用户没有邮箱时不发送邮件', async () => {
    // setupTestDb 创建的用户默认没有 email
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1, 2] })
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(0)
  })

  it('多用户中仅向有邮箱的用户发送', async () => {
    await setUserEmail(1, 'admin@test.com')
    // user 2 没有 email
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1, 2] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [recipients] = mockSendEmail.mock.calls[0]
    expect(recipients).toEqual(['admin@test.com'])
  })

  it('发送失败时日志记录 fail 状态', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'Connection refused' })
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.items[0].status).toBe('fail')
    expect(logs.items[0].errorMessage).toBe('Connection refused')
  })

  it('评论内容中的 HTML 被转义', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '<script>alert(1)</script>',
      content: '<img onerror="hack">',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('siteUrl 未设置时邮件仍发送，但不渲染外链而是显示降级提示', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'zh')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    // 故意不设 siteUrl
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [, , html] = mockSendEmail.mock.calls[0]
    // 不应渲染任何 admin 或 posts 路径的链接
    expect(html).not.toContain('/admin/comments')
    expect(html).not.toContain('/posts/')
    // 应显示中文降级提示
    expect(html).toContain('请登录后台查看并处理')

    // 邮件仍记 success 日志，因为本身发送成功
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.items[0].status).toBe('success')
  })

  it('siteUrl 含尾部斜杠时被规范化（不产生 double-slash）', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com/')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('https://example.com/admin/comments')
    expect(html).not.toContain('https://example.com//admin/comments')
    expect(html).not.toContain('https://example.com//posts/')
  })

  it('approved 状态以绿色文案渲染', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'zh')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'approved',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('color: #2f9e44; font-weight: 600;">已批准')
    expect(html).not.toContain('未批准')
    expect(html).not.toContain('已驳回')
  })

  it('rejected 状态以红色「已驳回」文案渲染', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'zh')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: '访客',
      content: '测试',
      contentId: post.id,
      status: 'rejected',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('color: #c92a2a; font-weight: 600;">已驳回')
    expect(html).not.toContain('未批准')
    expect(html).not.toContain('已批准')
  })

  it('文章 slug 含特殊字符时 URL 被 encodeURIComponent', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')

    // 构造一篇 slug 含空格和 & 的文章（绕过常规 createTestPost）
    const [post] = await testDb
      .insert(schema.contents)
      .values({
        type: 'post',
        title: 'Edge case',
        slug: 'hello world & co',
        authorId: 1,
        contentRaw: '# x',
        contentHtml: '<h1>x</h1>',
        contentText: 'x',
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
      .returning()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('https://example.com/posts/hello%20world%20%26%20co')
    expect(html).not.toContain('hello world & co</a>')
  })

  it('评论内容里 \\n / \\r\\n / \\r 三种换行符都被转成 <br>', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'line1\nline2\r\nline3\rline4',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('line1<br>line2<br>line3<br>line4')
    // 不应残留原始 \r 字符
    expect(html).not.toMatch(/\r/)
  })

  it('用户邮箱格式不合法时被 resolveRecipients 过滤掉，不发送邮件', async () => {
    // user 1 的 email 字段被填成非邮箱格式（数据脏污场景）
    await setUserEmail(1, 'not-an-email')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    const logs = await listEmailLogs({ page: 1, pageSize: 10 })
    expect(logs.total).toBe(0)
  })

  it('文章标题极长时 h2 被截断到 100 字符并加省略号', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')

    // 直接 raw insert 一篇 150 字符标题的文章
    const longTitle = 'A'.repeat(150)
    const [post] = await testDb
      .insert(schema.contents)
      .values({
        type: 'post',
        title: longTitle,
        slug: 'long-title',
        authorId: 1,
        contentRaw: 'x',
        contentHtml: 'x',
        contentText: 'x',
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
      .returning()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    // h2 应包含 100 个 A + 省略号；不应出现 101 个连续 A
    expect(html).toContain('A'.repeat(100) + '…')
    expect(html).not.toContain('A'.repeat(101))
  })

  it('文章标题含换行符时 subject 被压成单行（防 RFC 5322 违例）', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')

    // raw insert 含换行的标题
    const [post] = await testDb
      .insert(schema.contents)
      .values({
        type: 'post',
        title: '第一行\n第二行\r\n第三段',
        slug: 'multiline-title',
        authorId: 1,
        contentRaw: 'x',
        contentHtml: 'x',
        contentText: 'x',
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
      .returning()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, subject] = mockSendEmail.mock.calls[0]
    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).toContain('第一行 第二行 第三段')
  })

  it('siteUrl 含前后空格时被 trim 后正常解析', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', '  https://example.com  ')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('https://example.com/admin/comments')
  })

  it('siteUrl 只有协议没有 hostname（如 "https://"）时走降级', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'zh')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    // 不应渲染任何含 "https:///" 的坏链接
    expect(html).not.toMatch(/https:\/\/\//)
    expect(html).toContain('请登录后台查看并处理')
  })

  it('siteUrl 是非 http(s) 协议（如 "ftp://..."）时走降级', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'zh')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'ftp://example.com')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).not.toContain('ftp://')
    expect(html).toContain('请登录后台查看并处理')
  })

  it('siteUrl 含子路径（如 https://example.com/blog/）时保留 path 且去尾斜杠', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com/blog/')
    const post = await createTestPost()

    await notifyNewComment({
      authorName: 'X',
      content: 'Y',
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    expect(html).toContain('https://example.com/blog/admin/comments')
    expect(html).toContain('https://example.com/blog/posts/')
    expect(html).not.toContain('https://example.com/blog//')
  })

  it('评论内容含 emoji 且超长时不切断 surrogate pair', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewComment', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')
    const post = await createTestPost()

    // 😀 (U+1F600) 在 UTF-16 占 2 个 code unit，但是 1 个 code point
    // 501 个 emoji，按 code unit 切（旧 slice）会在第 251 个 emoji 中间切断
    const emoji = '😀'
    const content = emoji.repeat(501)

    await notifyNewComment({
      authorName: 'X',
      content,
      contentId: post.id,
      status: 'pending',
    })

    const [, , html] = mockSendEmail.mock.calls[0]
    // HTML 不应有孤立 surrogate（半个 emoji）
    expect(html).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
    expect(html).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    // 应包含 500 个完整 emoji + 截断符
    expect(html).toContain(emoji.repeat(500) + '…')
  })
})

describe('notifyNewGuestbook', () => {
  it('站点语言为英文时使用英文通知模板', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('language', 'en')
    await setSetting('emailNotifyNewGuestbook', { enabled: true, userIds: [1] })
    await setSetting('siteUrl', 'https://example.com')

    await notifyNewGuestbook({
      authorName: 'Visitor',
      content: 'Hello',
    })

    const [, subject, html] = mockSendEmail.mock.calls[0]
    expect(subject).toBe('New guestbook message from Visitor')
    expect(html).toContain('A new guestbook message was received')
    expect(html).toContain('View message')
  })

  it('开启通知时发送邮件', async () => {
    await setUserEmail(1, 'admin@test.com')
    await setSetting('emailNotifyNewGuestbook', { enabled: true, userIds: [1] })
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
