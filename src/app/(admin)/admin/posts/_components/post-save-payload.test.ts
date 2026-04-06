import { describe, expect, it } from 'vitest'
import { buildPostDraftPayload, buildPostSaveBody } from './post-save-payload'

describe('buildPostSaveBody', () => {
  it('草稿保存应携带完整主表元数据', () => {
    const body = buildPostSaveBody(
      {
        title: '文章标题',
        slug: 'post-slug',
        excerpt: '摘要',
        categoryId: '3',
        tagNames: ['前端', 'React'],
        allowComment: false,
        showComments: false,
        pinned: true,
        publishedAt: null,
        coverImage: '',
        seoTitle: 'SEO 标题',
        seoDescription: 'SEO 描述',
      },
      {
        contentType: 'markdown',
        contentRaw: '# Hello',
        contentHtml: '<h1>Hello</h1>',
        contentText: 'Hello',
      },
      [2, 5],
      'draft',
      { now: '2026-04-05T00:00:00.000Z' },
    )

    expect(body).toMatchObject({
      title: '文章标题',
      slug: 'post-slug',
      excerpt: '摘要',
      status: 'draft',
      categoryId: 3,
      tagIds: [2, 5],
      tagNames: ['前端', 'React'],
      allowComment: false,
      showComments: false,
      pinned: true,
      seoTitle: 'SEO 标题',
      seoDescription: 'SEO 描述',
      contentType: 'markdown',
      contentRaw: '# Hello',
      contentHtml: '<h1>Hello</h1>',
      contentText: 'Hello',
      publishedAt: null,
    })
  })
})

describe('buildPostDraftPayload', () => {
  it('运营属性（allowComment/showComments/pinned）不应进入草稿快照', () => {
    const body = buildPostDraftPayload(
      {
        title: '标题',
        slug: 'slug',
        excerpt: '',
        categoryId: '',
        tagNames: [],
        allowComment: false,
        showComments: false,
        pinned: true,
        publishedAt: null,
        coverImage: '',
        seoTitle: '',
        seoDescription: '',
      },
      {
        contentType: 'richtext',
        contentRaw: '<p>test</p>',
        contentHtml: '<p>test</p>',
        contentText: 'test',
      },
    )

    // 草稿快照的 metadata 不应包含运营属性
    const meta = body.metadata
    expect('allowComment' in meta).toBe(false)
    expect('showComments' in meta).toBe(false)
    expect('pinned' in meta).toBe(false)
  })

  it('应将文章 metadata 保存到草稿快照', () => {
    const body = buildPostDraftPayload(
      {
        title: '草稿标题',
        slug: 'duplicate-slug',
        excerpt: '草稿摘要',
        categoryId: '7',
        tagNames: ['Node.js', 'SQLite'],
        allowComment: true,
        showComments: false,
        pinned: true,
        publishedAt: '2026-04-06T08:00:00.000Z',
        coverImage: 'https://example.com/cover.jpg',
        seoTitle: '草稿 SEO',
        seoDescription: '草稿 SEO 描述',
      },
      {
        contentType: 'markdown',
        contentRaw: '# Draft',
        contentHtml: '<h1>Draft</h1>',
        contentText: 'Draft',
      },
    )

    expect(body).toEqual({
      title: '草稿标题',
      excerpt: '草稿摘要',
      contentType: 'markdown',
      contentRaw: '# Draft',
      contentHtml: '<h1>Draft</h1>',
      contentText: 'Draft',
      metadata: {
        slug: 'duplicate-slug',
        categoryId: 7,
        tagNames: ['Node.js', 'SQLite'],
        coverImage: 'https://example.com/cover.jpg',
        seoTitle: '草稿 SEO',
        seoDescription: '草稿 SEO 描述',
        publishedAt: '2026-04-06T08:00:00.000Z',
      },
    })
  })
})
