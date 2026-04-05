'use client'

import type { AuthUser } from '@/server/auth'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface AdminCounts {
  pendingComments: number
  unreadGuestbook: number
}

interface AdminContextValue {
  user: AuthUser | null
  counts: AdminCounts | null
  refreshCounts: () => Promise<void>
}

const AdminContext = createContext<AdminContextValue>({
  user: null,
  counts: null,
  refreshCounts: async () => {},
})

export function AdminCountsProvider({
  user,
  children,
}: {
  user: AuthUser | null
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
    <AdminContext.Provider value={{ user, counts, refreshCounts }}>
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
