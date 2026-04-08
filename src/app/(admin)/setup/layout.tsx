import { isSystemInitialized } from '@/server/auth'
import '@/styles/admin.scss'
import { redirect } from 'next/navigation'

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const initialized = await isSystemInitialized()
  if (initialized) redirect('/admin')

  return <>{children}</>
}
