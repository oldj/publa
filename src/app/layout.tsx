import HeadElements from '@/components/HeadElements'
import NProgressBar from '@/components/NProgress'
import PreviewStyles from '@/components/PreviewStyles'
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
    siteTitle = String(s.siteTitle ?? '') || siteTitle
    siteDescription = String(s.siteDescription ?? '')
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
  let siteSettings: Record<string, unknown> = {}
  try {
    siteSettings = await getAllSettings()
  } catch {
    // 数据库可能尚未初始化
  }

  const siteTitle = String(siteSettings.siteTitle ?? '') || 'Publa'
  const rssTitle = String(siteSettings.rssTitle ?? '') || siteTitle

  const customHeadHtml = String(siteSettings.customHeadHtml ?? '')
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isFrontend = !pathname.startsWith('/admin') && !pathname.startsWith('/setup')

  // 前台主题与自定义 CSS 注入：全部通过 /themes/[file] 路由动态输出，避免在布局里内联 CSS
  let themeHref: string | null = null
  let customCssHref: string | null = null
  if (isFrontend) {
    const activeThemeId =
      typeof siteSettings.activeThemeId === 'number' ? (siteSettings.activeThemeId as number) : 0
    const activeCustomStyleIds = Array.isArray(siteSettings.activeCustomStyleIds)
      ? (siteSettings.activeCustomStyleIds as number[])
      : []

    if (activeThemeId > 0) {
      themeHref = `/themes/theme.css?v=${activeThemeId}`
    }

    if (activeCustomStyleIds.length > 0) {
      // 用 id 列表做 cache bust，切换/编辑后会立即刷新
      const version = activeCustomStyleIds.join('-')
      customCssHref = `/themes/custom.css?v=${encodeURIComponent(version)}`
    }
  }

  return (
    <html lang="zh">
      <head>
        <link rel="alternate" type="application/rss+xml" title={rssTitle} href="/rss.xml" />
        {themeHref && <link rel="stylesheet" href={themeHref} />}
        {customCssHref && <link rel="stylesheet" href={customCssHref} />}
        {isFrontend && customHeadHtml && <HeadElements html={customHeadHtml} />}
      </head>
      <body data-role="body">
        <Suspense fallback={null}>
          <NProgressBar />
        </Suspense>
        {isFrontend && (
          <Suspense fallback={null}>
            <PreviewStyles />
          </Suspense>
        )}
        {children}
      </body>
    </html>
  )
}
