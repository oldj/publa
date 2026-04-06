import { describe, expect, it } from 'vitest'
import { buildPageRestoreInput, buildPostRestoreInput } from './revision-restore'

describe('buildPostRestoreInput', () => {
  it('恢复版本时不应包含运营属性（allowComment/showComments/pinned）', () => {
    const input = buildPostRestoreInput(
      {
        title: '标题',
        excerpt: '',
        contentType: 'richtext',
        contentRaw: '<p>test</p>',
        contentHtml: '<p>test</p>',
        contentText: 'test',
        metadata: {
          slug: 'old-slug',
          categoryId: null,
          tagNames: [],
          seoTitle: '',
          seoDescription: '',
        },
      },
      [],
    )

    expect('allowComment' in input).toBe(false)
    expect('showComments' in input).toBe(false)
    expect('pinned' in input).toBe(false)
  })

  it('恢复文章版本时不应回滚 slug', () => {
    const input = buildPostRestoreInput(
      {
        title: '旧标题',
        excerpt: '旧摘要',
        contentType: 'markdown',
        contentRaw: '# Old',
        contentHtml: '<h1>Old</h1>',
        contentText: 'Old',
        metadata: {
          slug: 'old-slug',
          categoryId: 3,
          tagNames: ['Node.js'],
          coverImage: 'https://example.com/cover.jpg',
          seoTitle: '旧 SEO',
          seoDescription: '旧描述',
        },
      },
      [7],
    )

    expect(input).toEqual({
      title: '旧标题',
      excerpt: '旧摘要',
      contentType: 'markdown',
      contentRaw: '# Old',
      contentHtml: '<h1>Old</h1>',
      contentText: 'Old',
      categoryId: 3,
      tagIds: [7],
      coverImage: 'https://example.com/cover.jpg',
      seoTitle: '旧 SEO',
      seoDescription: '旧描述',
      status: 'published',
    })
    expect('slug' in input).toBe(false)
  })
})

describe('buildPageRestoreInput', () => {
  it('恢复页面版本时不应回滚 path', () => {
    const input = buildPageRestoreInput({
      title: '旧页面',
      excerpt: '',
      contentType: 'html',
      contentRaw: '<p>old</p>',
      contentHtml: '<p>old</p>',
      contentText: 'old',
      metadata: {
        path: 'old-path',
        template: 'blank',
        seoTitle: '旧页面 SEO',
        seoDescription: '旧页面描述',
      },
    })

    expect(input).toEqual({
      title: '旧页面',
      contentType: 'html',
      contentRaw: '<p>old</p>',
      contentHtml: '<p>old</p>',
      template: 'blank',
      seoTitle: '旧页面 SEO',
      seoDescription: '旧页面描述',
      status: 'published',
    })
    expect('path' in input).toBe(false)
  })
})
