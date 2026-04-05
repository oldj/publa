'use client'

import { useEffect } from 'react'
import NProgress from 'nprogress'
import { usePathname, useSearchParams } from 'next/navigation'
import './NProgress.scss'

// 自定义 NProgress 样式
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  easing: 'ease',
  speed: 500,
  trickleSpeed: 200,
})

export default function NProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // 当路由变化时启动进度条
    NProgress.start()

    // 设置一个短暂的延迟，确保进度条显示
    const timer = setTimeout(() => {
      NProgress.done()
    }, 500)

    return () => {
      clearTimeout(timer)
      NProgress.done()
    }
  }, [pathname, searchParams])

  return null
}
