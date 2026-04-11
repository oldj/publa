/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import PreviewStyles from '@/components/PreviewStyles'
import { getAllSettings, toStr } from '@/server/services/settings'
import React, { Suspense } from 'react'

interface IProps {
  children?: React.ReactNode
}

// 前台通用样式/HTML 注入层：负责主题 CSS、自定义 CSS、customBodyStart/End HTML、预览样式。
// 不渲染 Nav / Footer 等结构，供 BasicLayout 与无页头页脚场景（如 404）共用。
export default async function BlankLayout(props: IProps) {
  const { children } = props
  const { themeHref, customCssHref, customBodyStartHtml, customBodyEndHtml } = await getData()

  return (
    <>
      {/* React 19 的 stylesheet hoisting 会把这些 <link> 自动提升到 document.head */}
      {themeHref && <link rel="stylesheet" href={themeHref} precedence="default" />}
      {customCssHref && <link rel="stylesheet" href={customCssHref} precedence="default" />}
      <Suspense fallback={null}>
        <PreviewStyles />
      </Suspense>

      {customBodyStartHtml && <div dangerouslySetInnerHTML={{ __html: customBodyStartHtml }} />}
      {children}
      {customBodyEndHtml && <div dangerouslySetInnerHTML={{ __html: customBodyEndHtml }} />}
    </>
  )
}

async function getData() {
  // 通过 getAllSettings（React cache 包裹）共享根布局已经完成的查询
  const s = await getAllSettings()

  // 当前选中的主题 / 自定义 CSS，用 id 做 cache bust
  const rawThemeId = s.activeThemeId
  const themeId = typeof rawThemeId === 'number' && rawThemeId > 0 ? rawThemeId : 0
  const themeHref = themeId > 0 ? `/themes/theme.css?v=${themeId}` : null

  const rawStyleIds = s.activeCustomStyleIds
  const customStyleIds = Array.isArray(rawStyleIds) ? (rawStyleIds as number[]) : []
  const customCssHref =
    customStyleIds.length > 0
      ? `/themes/custom.css?v=${encodeURIComponent(customStyleIds.join('-'))}`
      : null

  const customBodyStartHtml = toStr(s.customBodyStartHtml)
  const customBodyEndHtml = toStr(s.customBodyEndHtml)

  return { themeHref, customCssHref, customBodyStartHtml, customBodyEndHtml }
}
