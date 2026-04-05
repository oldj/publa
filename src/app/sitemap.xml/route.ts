export const dynamic = 'force-dynamic'

import { db } from '@/server/db'
import { categories, contents, tags } from '@/server/db/schema'
import { getSetting } from '@/server/services/settings'
import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const siteUrl = (await getSetting('siteUrl')) || new URL(request.url).origin
  const now = new Date().toISOString()

  // 获取所有已发布文章
  const postRows = await db
    .select({
      slug: contents.slug,
      updatedAt: contents.updatedAt,
      publishedAt: contents.publishedAt,
    })
    .from(contents)
    .where(
      and(
        eq(contents.type, 'post'),
        eq(contents.status, 'published'),
        lte(contents.publishedAt, now),
        isNull(contents.deletedAt),
      ),
    )
    .orderBy(desc(contents.publishedAt))

  // 获取所有已发布页面
  const pageRows = await db
    .select({ path: contents.path, updatedAt: contents.updatedAt })
    .from(contents)
    .where(
      and(eq(contents.type, 'page'), eq(contents.status, 'published'), isNull(contents.deletedAt)),
    )

  // 获取所有分类
  const categoryRows = await db.select({ slug: categories.slug }).from(categories)

  // 获取所有标签
  const tagRows = await db.select({ slug: tags.slug }).from(tags)

  const urls: { loc: string; lastmod?: string; priority?: string }[] = [
    { loc: siteUrl, priority: '1.0' },
    { loc: `${siteUrl}/posts`, priority: '0.8' },
    { loc: `${siteUrl}/guestbook`, priority: '0.5' },
  ]

  for (const post of postRows) {
    urls.push({
      loc: `${siteUrl}/posts/${post.slug}`,
      lastmod: post.updatedAt || post.publishedAt || undefined,
      priority: '0.7',
    })
  }

  for (const page of pageRows) {
    urls.push({
      loc: `${siteUrl}/${page.path}`,
      lastmod: page.updatedAt || undefined,
      priority: '0.6',
    })
  }

  for (const cat of categoryRows) {
    urls.push({ loc: `${siteUrl}/category/${cat.slug}`, priority: '0.5' })
  }

  for (const tag of tagRows) {
    urls.push({ loc: `${siteUrl}/tag/${tag.slug}`, priority: '0.4' })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod.substring(0, 10)}</lastmod>` : ''}${u.priority ? `\n    <priority>${u.priority}</priority>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
