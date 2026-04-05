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
})

describe('buildPageDraftPayload', () => {
  it('页面草稿快照应保留 path、template 和 SEO 字段', () => {
    const body = buildPageDraftPayload(
      {
        title: '草稿页面',
        path: 'invalid/path/',
        template: 'blank',
        status: 'draft',
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
      },
    })
  })
})
