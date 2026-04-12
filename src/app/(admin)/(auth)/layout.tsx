import { isSystemInitialized } from '@/server/auth'
import { getSetting } from '@/server/services/settings'
import '@/styles/admin.scss'
import { redirect } from 'next/navigation'
import { SiteShortTitleProvider } from '../_components/SiteShortTitleContext'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const initialized = await isSystemInitialized()
  if (!initialized) redirect('/setup')

  const siteShortTitle = (await getSetting('siteShortTitle')) || ''

  return <SiteShortTitleProvider initialValue={siteShortTitle}>{children}</SiteShortTitleProvider>
}
