'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'
import { useEffect, useRef } from 'react'
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
  // 标记"刚刚发生了后退/前进"，用于跳过滚动重置以保留浏览器原生滚动恢复
  const isPopStateRef = useRef(false)
  // 跳过首次挂载的滚动重置，避免覆盖 hash 定位或浏览器恢复的初始位置
  const isFirstRef = useRef(true)

  useEffect(() => {
    const onPopState = () => {
      isPopStateRef.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    // 当路由变化时启动进度条
    NProgress.start()

    // 路由切换时滚动到顶部：首次挂载、后退/前进时跳过
    if (isFirstRef.current) {
      isFirstRef.current = false
    } else if (isPopStateRef.current) {
      isPopStateRef.current = false
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }

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
