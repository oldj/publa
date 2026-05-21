'use client'

import type { AuthRole, AuthUser } from '@/server/auth'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface AdminCounts {
  pendingComments: number
  unreadGuestbook: number
}

interface AdminContextValue {
  user: AuthUser | null
  counts: AdminCounts | null
  refreshCounts: () => Promise<void>
  /** 哪些角色发布 HTML 时跳过净化（来自后台设置，SSR 注入） */
  htmlSanitizeBypassRoles: readonly AuthRole[]
}

const AdminContext = createContext<AdminContextValue>({
  user: null,
  counts: null,
  refreshCounts: async () => {},
  htmlSanitizeBypassRoles: ['owner', 'admin'],
})

export function AdminCountsProvider({
  user,
  htmlSanitizeBypassRoles,
  children,
}: {
  user: AuthUser | null
  htmlSanitizeBypassRoles: readonly AuthRole[]
  children: React.ReactNode
}) {
  const [counts, setCounts] = useState<AdminCounts | null>(null)

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/counts')
      const json = await res.json()
      if (json.success) setCounts(json.data)
    } catch {
      /* 忽略 */
    }
  }, [])

  useEffect(() => {
    void refreshCounts()
    const timer = setInterval(() => {
      void refreshCounts()
    }, 60_000)
    return () => clearInterval(timer)
  }, [refreshCounts])

  return (
    <AdminContext.Provider value={{ user, counts, refreshCounts, htmlSanitizeBypassRoles }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminCounts() {
  return useContext(AdminContext)
}

export function useCurrentUser() {
  return useContext(AdminContext).user
}

export function useHtmlSanitizeBypassRoles() {
  return useContext(AdminContext).htmlSanitizeBypassRoles
}
