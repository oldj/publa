import { describe, expect, it } from 'vitest'
import { buildPageDraftPayload, buildPageSaveBody } from './page-save-payload'

describe('buildPageSaveBody', () => {
  it('页面草稿保存应保留 path、template 和 SEO 字段', () => {
    const body = buildPageSaveBody(
      {
        title: '关于我们',
        path: 'about',
        template: 'blank',
        status: 'draft',
        publishedAt: null,
        seoTitle: '关于我们 - SEO',
        seoDescription: '页面描述',
      },
      {
        contentType: 'html',
        contentRaw: '<p>about</p>',
        contentHtml: '<p>about</p>',
        contentText: 'about',
      },
    )

    expect(body).toMatchObject({
      title: '关于我们',
      path: 'about',
      template: 'blank',
      status: 'draft',
      seoTitle: '关于我们 - SEO',
      seoDescription: '页面描述',
      contentType: 'html',
      contentRaw: '<p>about</p>',
      contentHtml: '<p>about</p>',
      contentText: 'about',
    })
  })

  it('草稿状态下 publishedAt 应置空', () => {
    const body = buildPageSaveBody(
      {
        title: '测试',
        path: 'test',
        template: 'default',
        status: 'published',
        publishedAt: '2026-01-01T00:00:00.000Z',
        seoTitle: '',
        seoDescription: '',
      },
      {
        contentType: 'richtext',
        contentRaw: '<p>test</p>',
        contentHtml: '<p>test</p>',
        contentText: 'test',
      },
      'draft',
    )

    expect(body.publishedAt).toBeNull()
    expect(body.status).toBe('draft')
  })

  it('定时发布时应使用 options.publishedAt', () => {
    const scheduledTime = '2026-06-01T10:00:00.000Z'
    const body = buildPageSaveBody(
      {
        title: '定时页面',
        path: 'scheduled-page',
        template: 'default',
        status: 'draft',
        publishedAt: null,
        seoTitle: '',
        seoDescription: '',
      },
      {
        contentType: 'richtext',
        contentRaw: '<p>content</p>',
        contentHtml: '<p>content</p>',
        contentText: 'content',
      },
      'scheduled',
      { publishedAt: scheduledTime },
    )

    expect(body.publishedAt).toBe(scheduledTime)
    expect(body.status).toBe('scheduled')
  })

  it('发布时如果没有 publishedAt 应使用 now', () => {
    const now = '2026-04-07T12:00:00.000Z'
    const body = buildPageSaveBody(
      {
        title: '发布页面',
        path: 'pub-page',
        template: 'default',
        status: 'draft',
        publishedAt: null,
        seoTitle: '',
        seoDescription: '',
      },
      {
        contentType: 'richtext',
        contentRaw: '<p>content</p>',
        contentHtml: '<p>content</p>',
        contentText: 'content',
      },
      'published',
      { now },
    )

    expect(body.publishedAt).toBe(now)
  })
})

describe('buildPageDraftPayload', () => {
  it('页面草稿快照应保留 path、template、SEO 和 publishedAt 字段', () => {
    const body = buildPageDraftPayload(
      {
        title: '草稿页面',
        path: 'invalid/path/',
        template: 'blank',
        status: 'draft',
        publishedAt: null,
        seoTitle: '页面 SEO',
        seoDescription: '页面描述',
      },
      {
        contentType: 'markdown',
        contentRaw: '# About',
        contentHtml: '<h1>About</h1>',
        contentText: 'About',
      },
    )

    expect(body).toEqual({
      title: '草稿页面',
      excerpt: '',
      contentType: 'markdown',
      contentRaw: '# About',
      contentHtml: '<h1>About</h1>',
      contentText: 'About',
      metadata: {
        path: 'invalid/path/',
        template: 'blank',
        seoTitle: '页面 SEO',
        seoDescription: '页面描述',
        publishedAt: null,
      },
    })
  })

  it('草稿快照应保留 publishedAt 值', () => {
    const body = buildPageDraftPayload(
      {
        title: '定时页面',
        path: 'scheduled',
        template: 'default',
        status: 'scheduled',
        publishedAt: '2026-06-01T10:00:00.000Z',
        seoTitle: '',
        seoDescription: '',
      },
      {
        contentType: 'richtext',
        contentRaw: '<p>content</p>',
        contentHtml: '<p>content</p>',
        contentText: 'content',
      },
    )

    expect(body.metadata.publishedAt).toBe('2026-06-01T10:00:00.000Z')
  })
})
