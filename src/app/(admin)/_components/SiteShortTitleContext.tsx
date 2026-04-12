'use client'

import { createContext, useContext, useState } from 'react'

interface SiteShortTitleContextValue {
  siteShortTitle: string
  setSiteShortTitle: (v: string) => void
}

const SiteShortTitleContext = createContext<SiteShortTitleContextValue>({
  siteShortTitle: 'Publa',
  setSiteShortTitle: () => {},
})

export function SiteShortTitleProvider({
  initialValue,
  children,
}: {
  initialValue: string
  children: React.ReactNode
}) {
  const [siteShortTitle, setSiteShortTitle] = useState(initialValue || 'Publa')

  return (
    <SiteShortTitleContext.Provider value={{ siteShortTitle, setSiteShortTitle }}>
      {children}
    </SiteShortTitleContext.Provider>
  )
}

export function useSiteShortTitle() {
  return useContext(SiteShortTitleContext)
}
