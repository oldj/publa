'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

/**
 * 前台主题预览模式。
 *
 * 触发方式：URL 带有 `__debug=<base64(JSON)>` 参数，payload 形如
 *   { theme: number | null, custom_styles: number[] }
 *
 * 组件职责：
 * 1. 解析 __debug，把预览主题与自定义 CSS 以 <link> 形式临时注入 <head>，
 *    追加在 layout 默认 link 之后，权重更高实现覆盖。
 * 2. 全局拦截点击事件，给同源前台链接自动追加相同的 __debug 参数，
 *    这样在预览窗口里点导航/文章链接时能继续沿用预览样式。
 *
 * 仅对登录用户有意义：服务端 `/themes/[file]` route handler 对未登录用户
 * 的预览参数会被忽略。
 */

interface DebugPayload {
  theme?: number | null
  custom_styles?: number[]
}

const SKIP_PATH_PREFIXES = ['/admin', '/setup', '/api/', '/_next/', '/themes/']

function parseDebugPayload(raw: string): DebugPayload | null {
  try {
    const binary = atob(raw)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object') return null
    return data as DebugPayload
  } catch {
    return null
  }
}

export default function PreviewStyles() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const debug = searchParams.get('__debug')

  const payload = useMemo(() => (debug ? parseDebugPayload(debug) : null), [debug])

  // 注入预览 <link>
  useEffect(() => {
    if (!payload) return

    const elements: HTMLLinkElement[] = []

    const themeId = payload.theme
    if (typeof themeId === 'number' && themeId > 0) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `/themes/theme.css?preview=${themeId}`
      link.dataset.previewStyles = 'theme'
      document.head.appendChild(link)
      elements.push(link)
    }

    const styleIds = payload.custom_styles
    if (Array.isArray(styleIds)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `/themes/custom.css?preview=${styleIds.join(',')}`
      link.dataset.previewStyles = 'custom'
      document.head.appendChild(link)
      elements.push(link)
    }

    return () => {
      for (const el of elements) el.remove()
    }
  }, [payload])

  // 全局链接重写：点击同源前台链接时自动带上 __debug 参数
  useEffect(() => {
    if (!debug) return

    const handleClick = (e: MouseEvent) => {
      // 只处理左键 (0) 和中键 (1)，其它按键放行
      if (e.button !== 0 && e.button !== 1) return

      const target = e.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      const rawHref = anchor.getAttribute('href')
      if (!rawHref || rawHref.startsWith('#')) return

      let url: URL
      try {
        url = new URL(rawHref, window.location.href)
      } catch {
        return
      }

      // 跳过跨域、后台路径、API/静态资源、动态样式路由
      if (url.origin !== window.location.origin) return
      if (SKIP_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return
      if (url.searchParams.has('__debug')) return

      url.searchParams.set('__debug', debug)

      const isModifierClick = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      const isMiddleClick = e.button === 1
      const isExplicitNewTab = anchor.target === '_blank'

      if (isModifierClick || isMiddleClick || isExplicitNewTab) {
        // 用户想在新标签打开：直接改 DOM href，让浏览器默认行为带上参数
        anchor.href = url.href
        return
      }

      // 普通左键：拦截 Next.js Link 内部的 router.push，自己 push 到带参数版本
      e.preventDefault()
      e.stopPropagation()
      router.push(url.pathname + url.search + url.hash)
    }

    document.addEventListener('click', handleClick, { capture: true })
    document.addEventListener('auxclick', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
      document.removeEventListener('auxclick', handleClick, { capture: true })
    }
  }, [debug, router])

  return null
}
