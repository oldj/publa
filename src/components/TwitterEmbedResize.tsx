'use client'

import { extractTwitterHeight } from '@/components/editors/embed/providers'
import { useEffect } from 'react'

/**
 * 监听 Twitter embed 的 postMessage，自动调整 iframe 高度。
 * 放在包含 embed 内容的页面即可，无需传 props。
 */
export default function TwitterEmbedResize() {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://platform.twitter.com') return
      const h = extractTwitterHeight(e.data)
      if (!h) return

      document
        .querySelectorAll<HTMLElement>('.embed[data-provider="twitter"]')
        .forEach((container) => {
          const iframe = container.querySelector('iframe')
          if (!iframe || e.source !== iframe.contentWindow) return
          container.style.minHeight = `${h}px`
          iframe.style.height = `${h}px`
        })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return null
}
