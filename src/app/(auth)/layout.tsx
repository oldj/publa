import { redirect } from 'next/navigation'
import { isSystemInitialized } from '@/server/auth'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const initialized = await isSystemInitialized()
  if (!initialized) redirect('/setup')

  return <>{children}</>
}
