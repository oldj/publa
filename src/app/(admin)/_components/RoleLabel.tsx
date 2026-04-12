import { useTranslations } from 'next-intl'
import { NowrapBadge } from './NowrapBadge'

const roleColorMap: Record<string, string> = {
  owner: 'red',
  admin: 'green',
  editor: 'gray',
}

export function RoleLabel({ role, size = 'md' }: { role: string; size?: string }) {
  const tCommon = useTranslations('common')
  const label =
    role === 'owner' || role === 'admin' || role === 'editor' ? tCommon(`roles.${role}`) : role
  const color = roleColorMap[role] || 'gray'
  return (
    <NowrapBadge size={size} color={color} variant="light">
      {label}
    </NowrapBadge>
  )
}
