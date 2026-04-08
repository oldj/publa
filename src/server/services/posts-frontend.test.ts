import { maybeFirst } from '@/server/db/query'
import * as schema from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb, testDb } from './__test__/setup'

const { getFrontendPostBySlug, getFrontendPosts } = await import('./posts-frontend')

beforeEach(async () => {
  await setupTestDb()
})

async function createPost(overrides: Partial<typeof schema.contents.$inferInsert> = {}) {
  const now = new Date()
  const basePost: typeof schema.contents.$inferInsert = {
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
    publishedAt: new Date(now.getTime() - 60_000).toISOString(),
  }

  const [row] = await testDb
    .insert(schema.contents)
    .values({ ...basePost, ...overrides })
    .returning()

  return row
}

describe('getFrontendPostBySlug', () => {
  it('已发布文章正常访问可返回数据，且不会在服务端增加浏览量', async () => {
    await createPost({ slug: 'published-post' })

    const post = await getFrontendPostBySlug('published-post')

    expect(post?.title).toBe('测试文章')

    const saved = await maybeFirst(
      testDb
        .select()
        .from(schema.contents)
        .where(eq(schema.contents.slug, 'published-post'))
        .limit(1),
    )
    expect(saved?.viewCount).toBe(0)
  })

  it('草稿文章正常访问返回 null', async () => {
    await createPost({
      slug: 'draft-post',
      status: 'draft',
      publishedAt: null,
    })

    const post = await getFrontendPostBySlug('draft-post')
    expect(post).toBeNull()
  })

  it.each([
    {
      label: '草稿',
      slug: 'preview-draft-no-user',
      status: 'draft' as const,
      publishedAt: null,
    },
    {
      label: '定时',
      slug: 'preview-scheduled-no-user',
      status: 'scheduled' as const,
      publishedAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  ])('%s文章带预览但无 viewer 返回 null', async ({ slug, status, publishedAt }) => {
    await createPost({ slug, status, publishedAt })

    const post = await getFrontendPostBySlug(slug, { preview: true })
    expect(post).toBeNull()
  })

  it.each([
    {
      label: '草稿',
      slug: 'preview-draft-with-user',
      status: 'draft' as const,
      publishedAt: null,
    },
    {
      label: '定时',
      slug: 'preview-scheduled-with-user',
      status: 'scheduled' as const,
      publishedAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  ])(
    '%s文章带预览且有 viewer 时可访问，且不增加浏览量并关闭评论交互',
    async ({ slug, status, publishedAt }) => {
      await createPost({ slug, status, publishedAt })

      const post = await getFrontendPostBySlug(slug, {
        preview: true,
        viewer: { id: 1 },
      })

      expect(post).not.toBeNull()
      expect(post?.canComment).toBe(false)

      const saved = await maybeFirst(
        testDb.select().from(schema.contents).where(eq(schema.contents.slug, slug)).limit(1),
      )
      expect(saved?.viewCount).toBe(0)
    },
  )

  it('预览模式下 miss 当前 slug 时不走 slug 历史跳转', async () => {
    await createPost({ id: 10, slug: 'current-slug' })
    await testDb.insert(schema.slugHistories).values({
      contentId: 10,
      slug: 'old-slug',
    })

    const post = await getFrontendPostBySlug('old-slug', {
      preview: true,
      viewer: { id: 1 },
    })

    expect(post).toBeNull()
  })
})

describe('getFrontendPosts', () => {
  it('可直接按 categoryId 过滤文章', async () => {
    const [categoryA] = await testDb
      .insert(schema.categories)
      .values({ name: '分类A', slug: 'cat-a', sortOrder: 0 })
      .returning()
    const [categoryB] = await testDb
      .insert(schema.categories)
      .values({ name: '分类B', slug: 'cat-b', sortOrder: 1 })
      .returning()

    await createPost({ slug: 'post-a', categoryId: categoryA.id })
    await createPost({ slug: 'post-b', categoryId: categoryB.id })

    const result = await getFrontendPosts({ categoryId: categoryA.id })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].slug).toBe('post-a')
  })

  it('可直接按 tagId 过滤文章', async () => {
    const [tagA] = await testDb
      .insert(schema.tags)
      .values({ name: '标签A', slug: 'tag-a' })
      .returning()
    const [tagB] = await testDb
      .insert(schema.tags)
      .values({ name: '标签B', slug: 'tag-b' })
      .returning()

    const postA = await createPost({ slug: 'tagged-a' })
    const postB = await createPost({ slug: 'tagged-b' })

    await testDb.insert(schema.contentTags).values([
      { contentId: postA.id, tagId: tagA.id },
      { contentId: postB.id, tagId: tagB.id },
    ])

    const result = await getFrontendPosts({ tagId: tagA.id })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].slug).toBe('tagged-a')
  })
})
