export const dynamic = 'force-dynamic'

import { db } from '@/server/db'
import { contents } from '@/server/db/schema'
import { getSetting } from '@/server/services/settings'
import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import { Feed } from 'feed'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const siteUrl = (await getSetting('siteUrl')) || new URL(request.url).origin
  const siteTitle = (await getSetting('siteTitle')) || 'Publa'
  const siteDescription = (await getSetting('siteDescription')) || ''
  const rssLimit = parseInt((await getSetting('rssLimit')) || '10')
  const rssContent = (await getSetting('rssContent')) || 'full'

  const now = new Date().toISOString()

  const rows = await db
    .select()
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
    .limit(rssLimit)

  const feed = new Feed({
    title: siteTitle,
    description: siteDescription,
    id: siteUrl,
    link: siteUrl,
    language: 'zh',
    copyright: `All rights reserved ${new Date().getFullYear()}`,
    updated: rows[0]?.publishedAt ? new Date(rows[0].publishedAt) : new Date(),
  })

  for (const post of rows) {
    const description =
      rssContent === 'full'
        ? post.contentHtml
        : post.excerpt || post.excerptAuto || post.contentText.substring(0, 200)

    feed.addItem({
      title: post.title,
      id: `${siteUrl}/posts/${post.slug}`,
      link: `${siteUrl}/posts/${post.slug}`,
      description,
      date: post.publishedAt ? new Date(post.publishedAt) : new Date(post.createdAt),
    })
  }

  return new NextResponse(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
