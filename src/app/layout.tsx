import HeadElements from '@/components/HeadElements'
import NProgressBar from '@/components/NProgress'
import { buildFaviconHref, getFaviconConfigFromSettings } from '@/server/services/favicon'
import { getAllSettings } from '@/server/services/settings'
import '@/styles/globals.scss'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  let siteTitle = 'Publa'
  let siteDescription = ''
  let faviconHref = buildFaviconHref()

  try {
    const s = await getAllSettings()
    siteTitle = s.siteTitle || siteTitle
    siteDescription = s.siteDescription || ''
    faviconHref = buildFaviconHref(getFaviconConfigFromSettings(s).version)
  } catch {
    // 数据库可能尚未初始化
  }

  return {
    title: {
      default: siteTitle,
      template: `%s - ${siteTitle}`,
    },
    description: siteDescription || siteTitle,
    icons: {
      icon: faviconHref,
      shortcut: faviconHref,
    },
  }
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  userScalable: 'no',
}

export default async function RootLayout({ children }: { children: any }) {
  // 从数据库读取设置
  let siteSettings: Record<string, string> = {}
  try {
    siteSettings = await getAllSettings()
  } catch {
    // 数据库可能尚未初始化
  }

  const siteTitle = siteSettings.siteTitle || 'Publa'
  const rssTitle = siteSettings.rssTitle || siteTitle

  const customHeadHtml = siteSettings.customHeadHtml || ''
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isFrontend = !pathname.startsWith('/admin') && !pathname.startsWith('/setup')

  return (
    <html lang="zh">
      <head>
        <link rel="alternate" type="application/rss+xml" title={rssTitle} href="/rss.xml" />
        {isFrontend && customHeadHtml && <HeadElements html={customHeadHtml} />}
      </head>
      <body data-role="body">
        <Suspense fallback={null}>
          <NProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
