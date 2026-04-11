/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import PreviewStyles from '@/components/PreviewStyles'
import { getBuiltinKeyById } from '@/server/services/builtin-themes'
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

  // 当前选中的主题 / 自定义 CSS：
  // - 内置 light/dark → 直接指向 public 下的静态 CSS，Next.js 静态资源层伺服，零动态查询
  // - 内置 blank → 不渲染 link
  // - 自定义主题 → 走 /themes/theme.css 动态 handler，?v={id} 用于缓存失效
  // builtin id→key 映射由 getBuiltinKeyById 在模块级内存缓存，首次访问后不再查库
  const rawThemeId = s.activeThemeId
  const themeId = typeof rawThemeId === 'number' && rawThemeId > 0 ? rawThemeId : 0
  let themeHref: string | null = null
  if (themeId > 0) {
    const builtinKey = await getBuiltinKeyById(themeId)
    if (builtinKey === 'light' || builtinKey === 'dark') {
      themeHref = `/themes/${builtinKey}.css`
    } else if (builtinKey === null) {
      themeHref = `/themes/theme.css?v=${themeId}`
    }
    // builtinKey === 'blank' 时 themeHref 保持 null，不渲染 link
  }

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
