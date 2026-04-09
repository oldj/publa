import { adminUrl } from '@/lib/admin-path'
import { getCurrentUser, isSystemInitialized } from '@/server/auth'
import '@/styles/admin.scss'
import { redirect } from 'next/navigation'
import { AdminShell } from '../_components/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    const initialized = await isSystemInitialized()
    redirect(initialized ? adminUrl('/login') : '/setup')
  }

  return <AdminShell user={user}>{children}</AdminShell>
}
