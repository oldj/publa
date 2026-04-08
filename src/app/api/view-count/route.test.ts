import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

const { POST } = await import('./route')

beforeEach(async () => {
  await setupTestDb()
})

async function createPost(overrides: Partial<typeof schema.contents.$inferInsert> = {}) {
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

function postRequest(body: unknown) {
  return POST(
    new Request('http://localhost/api/view-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
  )
}

describe('/api/view-count', () => {
  it('已发布文章浏览数正常递增', async () => {
    await createPost({ slug: 'published-post' })

    const res1 = await postRequest({ slug: 'published-post' })
    expect(res1.status).toBe(200)
    expect((await res1.json()).success).toBe(true)

    const res2 = await postRequest({ slug: 'published-post' })
    expect(res2.status).toBe(200)

    const saved = await maybeFirst(
      testDb
        .select()
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'published-post'))
        .limit(1),
    )
    expect(saved?.viewCount).toBe(2)
  })

  it('缺少 slug 返回 VALIDATION_ERROR', async () => {
    const res = await postRequest({})
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('不存在的 slug 返回 NOT_FOUND', async () => {
    const res = await postRequest({ slug: 'nonexistent' })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })

  it('草稿文章不计数，返回 NOT_FOUND', async () => {
    await createPost({ slug: 'draft-post', status: 'draft', publishedAt: null })

    const res = await postRequest({ slug: 'draft-post' })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')

    const saved = await maybeFirst(
      testDb
        .select()
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'draft-post'))
        .limit(1),
    )
    expect(saved?.viewCount).toBe(0)
  })

  it('已删除文章不计数，返回 NOT_FOUND', async () => {
    await createPost({
      slug: 'deleted-post',
      deletedAt: new Date().toISOString(),
    })

    const res = await postRequest({ slug: 'deleted-post' })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
  })
})
