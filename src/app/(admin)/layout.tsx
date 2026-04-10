import { getAdminPath } from '@/lib/admin-path'
import { AdminPathProvider } from './_components/AdminPathContext'
import MantineShell from './_components/MantineShell'

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const adminPath = getAdminPath()
  return (
    <MantineShell>
      <AdminPathProvider adminPath={adminPath}>{children}</AdminPathProvider>
    </MantineShell>
  )
}
