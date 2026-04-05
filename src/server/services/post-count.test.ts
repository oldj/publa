import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestDb } from './__test__/setup'
import type { PostInput } from './posts'

const { listCategories } = await import('./categories')
const { listTags } = await import('./tags')
const { createPost, updatePost, deletePost } = await import('./posts')
const { createCategory } = await import('./categories')
const { createTag } = await import('./tags')

beforeEach(async () => {
  await setupTestDb()
})

function makePost(overrides: Partial<PostInput> = {}): PostInput {
  return {
    title: '测试文章',
    slug: 'test-post',
    authorId: 1,
    contentRaw: '# 标题',
    contentHtml: '<h1>标题</h1>',
    contentText: '标题',
    status: 'published',
    publishedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('categories 和 tags 的 postCount 只计已发布未删除文章', () => {
  it('草稿文章不计入 postCount', async () => {
    const category = await createCategory({ name: '分类A', slug: 'cat-a' })
    const tag = await createTag({ name: '标签A', slug: 'tag-a' })

    await createPost(
      makePost({
        slug: 'draft',
        status: 'draft',
        categoryId: category.id,
        tagIds: [tag.id],
        publishedAt: undefined,
      }),
    )

    const categories = await listCategories()
    expect(categories.find((c) => c.slug === 'cat-a')?.postCount).toBe(0)

    const tags = await listTags()
    expect(tags.find((t) => t.slug === 'tag-a')?.postCount).toBe(0)
  })

  it('定时发布文章不计入 postCount', async () => {
    const category = await createCategory({ name: '分类B', slug: 'cat-b' })
    const tag = await createTag({ name: '标签B', slug: 'tag-b' })

    await createPost(
      makePost({
        slug: 'scheduled',
        status: 'scheduled',
        categoryId: category.id,
        tagIds: [tag.id],
        publishedAt: '2099-01-01T00:00:00.000Z',
      }),
    )

    const categories = await listCategories()
    expect(categories.find((c) => c.slug === 'cat-b')?.postCount).toBe(0)

    const tags = await listTags()
    expect(tags.find((t) => t.slug === 'tag-b')?.postCount).toBe(0)
  })

  it('已删除文章不计入 postCount', async () => {
    const category = await createCategory({ name: '分类C', slug: 'cat-c' })
    const tag = await createTag({ name: '标签C', slug: 'tag-c' })

    const post = await createPost(
      makePost({
        slug: 'to-delete',
        categoryId: category.id,
        tagIds: [tag.id],
      }),
    )
    await deletePost(post.id)

    const categories = await listCategories()
    expect(categories.find((c) => c.slug === 'cat-c')?.postCount).toBe(0)

    const tags = await listTags()
    expect(tags.find((t) => t.slug === 'tag-c')?.postCount).toBe(0)
  })

  it('文章状态变化时 postCount 动态更新', async () => {
    const category = await createCategory({ name: '分类D', slug: 'cat-d' })
    const tag = await createTag({ name: '标签D', slug: 'tag-d' })

    // 创建草稿：计数为 0
    const post = await createPost(
      makePost({
        slug: 'state-change',
        status: 'draft',
        categoryId: category.id,
        tagIds: [tag.id],
        publishedAt: undefined,
      }),
    )

    expect((await listCategories()).find((c) => c.slug === 'cat-d')?.postCount).toBe(0)
    expect((await listTags()).find((t) => t.slug === 'tag-d')?.postCount).toBe(0)

    // 改为已发布：计数变为 1
    await updatePost(post.id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
    })

    expect((await listCategories()).find((c) => c.slug === 'cat-d')?.postCount).toBe(1)
    expect((await listTags()).find((t) => t.slug === 'tag-d')?.postCount).toBe(1)

    // 软删除：计数回到 0
    await deletePost(post.id)

    expect((await listCategories()).find((c) => c.slug === 'cat-d')?.postCount).toBe(0)
    expect((await listTags()).find((t) => t.slug === 'tag-d')?.postCount).toBe(0)
  })

  it('多篇文章混合状态时只计 published 未删除的', async () => {
    const category = await createCategory({ name: '分类E', slug: 'cat-e' })
    const tag = await createTag({ name: '标签E', slug: 'tag-e' })

    // 1 篇 published
    await createPost(
      makePost({
        slug: 'pub-1',
        categoryId: category.id,
        tagIds: [tag.id],
      }),
    )
    // 1 篇 draft
    await createPost(
      makePost({
        slug: 'draft-1',
        status: 'draft',
        categoryId: category.id,
        tagIds: [tag.id],
        publishedAt: undefined,
      }),
    )
    // 1 篇 scheduled
    await createPost(
      makePost({
        slug: 'sched-1',
        status: 'scheduled',
        categoryId: category.id,
        tagIds: [tag.id],
        publishedAt: '2099-01-01T00:00:00.000Z',
      }),
    )
    // 1 篇 published 但已删除
    const deleted = await createPost(
      makePost({
        slug: 'deleted-1',
        categoryId: category.id,
        tagIds: [tag.id],
      }),
    )
    await deletePost(deleted.id)

    const categories = await listCategories()
    expect(categories.find((c) => c.slug === 'cat-e')?.postCount).toBe(1)

    const tags = await listTags()
    expect(tags.find((t) => t.slug === 'tag-e')?.postCount).toBe(1)
  })
})
