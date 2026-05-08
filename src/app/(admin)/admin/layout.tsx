import { AdminShell } from '@/app/(admin)/_components/AdminShell'
import { SiteShortTitleProvider } from '@/app/(admin)/_components/SiteShortTitleContext'
import { adminUrl } from '@/lib/admin-path'
import { getCurrentUser, isSystemInitialized } from '@/server/auth'
import { getSetting } from '@/server/services/settings'
import '@/styles/admin.scss'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    const initialized = await isSystemInitialized()
    redirect(initialized ? adminUrl('/login') : '/setup')
  }

  const siteShortTitle = (await getSetting('siteShortTitle')) || ''

  return (
    <SiteShortTitleProvider initialValue={siteShortTitle}>
      <AdminShell user={user}>{children}</AdminShell>
    </SiteShortTitleProvider>
  )
}
