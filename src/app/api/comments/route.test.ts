import { COMMENT_MAX_LENGTH } from '@/lib/constants'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'

const { mockGetCurrentUser, mockVerifyCaptcha, mockCookies } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockVerifyCaptcha: vi.fn(),
  mockCookies: vi.fn(),
}))

vi.mock('@/server/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
}))

vi.mock('@/server/lib/captcha', () => ({
  verifyCaptcha: mockVerifyCaptcha,
}))

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}))

const { GET, POST } = await import('./route')

beforeEach(async () => {
  await setupTestDb()
  mockGetCurrentUser.mockReset()
  mockVerifyCaptcha.mockReset()
  mockCookies.mockReset()

  mockGetCurrentUser.mockResolvedValue(null)
  mockVerifyCaptcha.mockResolvedValue(true)
  mockCookies.mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'captcha-session' }),
  })
})

async function createPost(
  overrides: Partial<typeof schema.contents.$inferInsert> = {},
) {
  await testDb.insert(schema.contents).values({
    type: 'post',
    title: '测试文章',
    slug: 'test-post',
    authorId: 1,
    contentRaw: '# 标题',
    contentHtml: '<h1>标题</h1>',
    contentText: '标题',
    status: 'published',
    allowComment: true,
    showComments: true,
    viewCount: 0,
    pinned: false,
    publishedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  })
}

describe('/api/comments', () => {
  it('已发布文章评论对未登录用户开放', async () => {
    await createPost({ slug: 'published-post' })
    await testDb.insert(schema.comments).values({
      contentId: 1,
      authorName: '访客',
      content: '已审核评论',
      status: 'approved',
    })

    const response = await GET(new Request('http://localhost/api/comments?slug=published-post') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
  })

  it('未发布文章评论对未登录用户返回 404', async () => {
    await createPost({
      slug: 'draft-post',
      status: 'draft',
      publishedAt: null,
    })

    const response = await GET(new Request('http://localhost/api/comments?slug=draft-post') as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })

  it('未发布文章评论对已登录用户可访问', async () => {
    await createPost({
      slug: 'draft-post-staff',
      status: 'draft',
      publishedAt: null,
    })
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'owner' })

    const response = await GET(new Request('http://localhost/api/comments?slug=draft-post-staff') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('未发布文章评论提交对未登录用户返回 404', async () => {
    await createPost({
      slug: 'draft-post-submit',
      status: 'draft',
      publishedAt: null,
    })

    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'draft-post-submit',
        username: '访客',
        content: '测试评论',
        captchaCode: '1234',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')

    const savedComments = await testDb.select().from(schema.comments)
    expect(savedComments).toHaveLength(0)
  })

  it('未发布文章评论提交对已登录用户可用', async () => {
    await createPost({
      slug: 'draft-post-submit-staff',
      status: 'draft',
      publishedAt: null,
    })
    mockGetCurrentUser.mockResolvedValue({ id: 1, username: 'admin', role: 'owner' })

    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId: 1,
        username: '管理员',
        content: '内部预览评论',
        captchaCode: '1234',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)

    const savedComment = await maybeFirst(
      testDb
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.contentId, 1))
        .limit(1),
    )
    expect(savedComment?.content).toBe('内部预览评论')
    expect(savedComment?.userId).toBe(1)
  })

  it('评论内容超过最大长度时返回 CONTENT_TOO_LONG', async () => {
    await createPost({ slug: 'length-test-post' })

    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'length-test-post',
        username: '访客',
        content: 'a'.repeat(COMMENT_MAX_LENGTH + 1),
        captchaCode: '1234',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.code).toBe('CONTENT_TOO_LONG')
  })

  it('评论内容恰好等于最大长度时可以提交', async () => {
    await createPost({ slug: 'exact-length-post' })

    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'exact-length-post',
        username: '访客',
        content: 'a'.repeat(COMMENT_MAX_LENGTH),
        captchaCode: '1234',
      }),
    }) as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('30 秒内重复提交评论返回 RATE_LIMITED', async () => {
    await createPost({ slug: 'rate-limit-post' })

    // 第一次提交
    const first = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'rate-limit-post',
        username: '访客',
        content: '第一条评论',
        captchaCode: '1234',
      }),
    }) as any)
    expect((await first.json()).success).toBe(true)

    // 重置验证码 mock（验证码验证后会被消耗）
    mockVerifyCaptcha.mockResolvedValue(true)

    // 第二次提交应被限制
    const second = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'rate-limit-post',
        username: '访客',
        content: '第二条评论',
        captchaCode: '1234',
      }),
    }) as any)
    const json = await second.json()

    expect(second.status).toBe(429)
    expect(json.code).toBe('RATE_LIMITED')
  })

  it('评论列表会对危险 HTML 做转义并清洗危险链接', async () => {
    await createPost({ slug: 'unsafe-comment-post' })
    await testDb.insert(schema.comments).values({
      contentId: 1,
      authorName: '访客',
      authorWebsite: 'javascript:alert(1)',
      content: '<script>alert(1)</script>\n第二行',
      status: 'approved',
    })

    const response = await GET(new Request('http://localhost/api/comments?slug=unsafe-comment-post') as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data[0].html).toBe('&lt;script&gt;alert(1)&lt;/script&gt;<br />第二行')
    expect(json.data[0].url).toBe('')
  })
})
