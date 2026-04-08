import { NowrapBadge } from './NowrapBadge'

const roleMap: Record<string, { label: string; color: string }> = {
  owner: { label: '站长', color: 'red' },
  admin: { label: '管理员', color: 'green' },
  editor: { label: '编辑', color: 'gray' },
}

export function RoleLabel({ role, size = 'md' }: { role: string; size?: string }) {
  const r = roleMap[role] || { label: role, color: 'gray' }
  return (
    <NowrapBadge size={size} color={r.color} variant="light">
      {r.label}
    </NowrapBadge>
  )
}
