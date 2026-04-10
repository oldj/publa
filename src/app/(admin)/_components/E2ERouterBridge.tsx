'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

declare global {
  interface Window {
    __PUBLA_E2E_ROUTER_PUSH?: (href: string) => void
  }
}

export function E2ERouterBridge() {
  const router = useRouter()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== '1') {
      return
    }

    window.__PUBLA_E2E_ROUTER_PUSH = (href: string) => {
      router.push(href)
    }

    return () => {
      delete window.__PUBLA_E2E_ROUTER_PUSH
    }
  }, [router])

  return null
}
