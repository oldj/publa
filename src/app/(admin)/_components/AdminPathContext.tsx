'use client'

import { createContext, useCallback, useContext } from 'react'

const AdminPathContext = createContext<string>('admin')

export function AdminPathProvider({
  adminPath,
  children,
}: {
  adminPath: string
  children: React.ReactNode
}) {
  return <AdminPathContext.Provider value={adminPath}>{children}</AdminPathContext.Provider>
}

/** 返回一个路径构建函数，如 adminUrl('/posts') => '/backstage/posts' */
export function useAdminUrl(): (subpath?: string) => string {
  const adminPath = useContext(AdminPathContext)
  return useCallback(
    (subpath?: string) => {
      const base = `/${adminPath}`
      if (!subpath) return base
      return `${base}${subpath.startsWith('/') ? subpath : `/${subpath}`}`
    },
    [adminPath],
  )
}
