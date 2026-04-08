'use client'

import { useEffect, useRef } from 'react'

interface IProps {
  html: string
  className?: string
}

/**
 * 在客户端挂载后命令式注入 HTML 并执行其中的 <script> 标签，
 * 避免 SSR 水合不匹配问题（如嵌入第三方广告代码）。
 */
export default function UnsafeHtml({ html, className }: IProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.innerHTML = html

    // innerHTML 不会执行 <script>，需要手动重新创建
    const scripts = el.querySelectorAll('script')
    scripts.forEach((orig) => {
      const script = document.createElement('script')
      for (const attr of orig.attributes) {
        script.setAttribute(attr.name, attr.value)
      }
      if (orig.textContent) {
        script.textContent = orig.textContent
      }
      orig.replaceWith(script)
    })

    return () => {
      el.innerHTML = ''
    }
  }, [html])

  return <div ref={ref} className={className} />
}
