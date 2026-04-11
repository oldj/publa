/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import PreviewStyles from '@/components/PreviewStyles'
import { getMenuTree } from '@/server/services/menus'
import { getFrontendCategories, getFrontendTags } from '@/server/services/posts-frontend'
import { getSetting, toBool, toStr } from '@/server/services/settings'
import React, { Suspense } from 'react'
import Footer from 'src/components/footer'
import Nav from 'src/components/nav'

interface IProps {
  children?: React.ReactNode
}

export default async function BasicLayout(props: IProps) {
  const { children } = props
  const {
    categories,
    tags,
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
    customBodyStartHtml,
    customBodyEndHtml,
    enableSearch,
    themeHref,
    customCssHref,
  } = await getData()

  return (
    <>
      {/* React 19 的 stylesheet hoisting 会把这些 <link> 自动提升到 document.head */}
      {themeHref && <link rel="stylesheet" href={themeHref} precedence="default" />}
      {customCssHref && <link rel="stylesheet" href={customCssHref} precedence="default" />}
      <Suspense fallback={null}>
        <PreviewStyles />
      </Suspense>

      {customBodyStartHtml && <div dangerouslySetInnerHTML={{ __html: customBodyStartHtml }} />}

      <div className="basic-layout">
        <Nav menus={menus} siteTitle={siteTitle} siteSlogan={siteSlogan} />
        <main className="basic-layout-body">{children}</main>
      </div>

      <Footer
        categories={categories || []}
        tags={tags || []}
        footerCopyright={footerCopyright}
        enableSearch={enableSearch}
      />
      {customBodyEndHtml && <div dangerouslySetInnerHTML={{ __html: customBodyEndHtml }} />}
    </>
  )
}

async function getData() {
  const categories = await getFrontendCategories()
  const tags = await getFrontendTags()
  const menus = await getMenuTree()
  const siteTitle = toStr(await getSetting('siteTitle'), 'Publa')
  const siteSlogan = toStr(await getSetting('siteSlogan'), 'Yet Another Amazing Blog')
  const year = String(new Date().getFullYear())
  const rawCopyright = toStr(await getSetting('footerCopyright'), '{SITE_NAME} &copy; {FULL_YEAR}')
  const footerCopyright = rawCopyright
    .replace(/\{SITE_NAME}/g, siteTitle)
    .replace(/\{FULL_YEAR}/g, year)

  const customBodyStartHtml = toStr(await getSetting('customBodyStartHtml'))
  const customBodyEndHtml = toStr(await getSetting('customBodyEndHtml'))
  const enableSearch = toBool(await getSetting('enableSearch'), false)

  // 当前选中的主题 / 自定义 CSS，用 id 做 cache bust。
  // 仅前台（走 BasicLayout）页面才会拉这些样式，admin 不受影响。
  const rawThemeId = await getSetting('activeThemeId')
  const themeId = typeof rawThemeId === 'number' && rawThemeId > 0 ? rawThemeId : 0
  const themeHref = themeId > 0 ? `/themes/theme.css?v=${themeId}` : null

  const rawStyleIds = await getSetting('activeCustomStyleIds')
  const customStyleIds = Array.isArray(rawStyleIds) ? (rawStyleIds as number[]) : []
  const customCssHref =
    customStyleIds.length > 0
      ? `/themes/custom.css?v=${encodeURIComponent(customStyleIds.join('-'))}`
      : null

  return {
    categories: categories || [],
    tags: tags || [],
    menus,
    siteTitle,
    siteSlogan,
    footerCopyright,
    customBodyStartHtml,
    customBodyEndHtml,
    enableSearch,
    themeHref,
    customCssHref,
  }
}
