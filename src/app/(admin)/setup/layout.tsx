import { adminUrl } from '@/lib/admin-path'
import { isSystemInitialized } from '@/server/auth'
import '@/styles/admin.scss'
import { redirect } from 'next/navigation'

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const initialized = await isSystemInitialized()
  if (initialized) redirect(adminUrl())

  return <>{children}</>
}
