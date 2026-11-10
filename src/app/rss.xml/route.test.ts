import { contents } from '@/server/db/schema'
import { setupTestDb, testDb } from '@/server/services/__test__/setup'
import { beforeEach, describe, expect, it } from 'vitest'

const { GET } = await import('./route')
const { setSetting } = await import('@/server/services/settings')

beforeEach(async () => {
  await setupTestDb()
})

describe('RSS 输出兼容性', () => {
  it('输出有效的 RSS，转义标题并保留文章 HTML', async () => {
    await setSetting('siteTitle', '博客 & 技术')
    await testDb.insert(contents).values({
      type: 'post',
      title: '文章 & 示例',
      slug: 'rss-example',
      authorId: 1,
      status: 'published',
      publishedAt: '2020-01-01T00:00:00.000Z',
      contentHtml: '<p>正文</p>',
    })

    const response = await GET(new Request('https://example.com/rss.xml'))
    const xml = await response.text()

    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(xml).toContain('<rss version="2.0">')
    expect(xml).toContain('<title>博客 &amp; 技术</title>')
    expect(xml).toContain('<title><![CDATA[文章 & 示例]]></title>')
    expect(xml).toContain('<link>https://example.com/posts/rss-example</link>')
    expect(xml).toContain('<![CDATA[<p>正文</p>]]>')
  })

  it('摘要模式遵循条数上限，排除草稿和未来文章', async () => {
    await setSetting('rssContent', 'excerpt')
    await setSetting('rssLimit', 1)
    await testDb.insert(contents).values(
      (
        [
          { slug: 'older', status: 'published', publishedAt: '2020-01-01T00:00:00.000Z' },
          { slug: 'newer', status: 'published', publishedAt: '2020-01-02T00:00:00.000Z' },
          { slug: 'draft', status: 'draft', publishedAt: '2020-01-03T00:00:00.000Z' },
          { slug: 'future', status: 'published', publishedAt: '2999-01-01T00:00:00.000Z' },
        ] as const
      ).map((post) => ({
        ...post,
        type: 'post' as const,
        title: post.slug,
        authorId: 1,
        excerpt: '文章摘要',
        contentHtml: '<p>完整正文</p>',
      })),
    )

    const response = await GET(new Request('https://example.com/rss.xml'))
    const xml = await response.text()

    expect(xml.match(/<item>/g)).toHaveLength(1)
    expect(xml).toContain('/posts/newer')
    expect(xml).toContain('文章摘要')
    expect(xml).not.toContain('完整正文')
    for (const slug of ['older', 'draft', 'future']) {
      expect(xml).not.toContain(`/posts/${slug}`)
    }
  })
})
