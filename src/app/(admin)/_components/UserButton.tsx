'use client'

import type { AuthUser } from '@/server/auth'
import { ActionIcon, Avatar, Group, Text } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useAdminUrl } from './AdminPathContext'
import myModal from './myModals'
import { RoleLabel } from './RoleLabel'
import classes from './UserButton.module.scss'

export function UserButton({ user }: { user: AuthUser | null }) {
  const router = useRouter()
  const adminUrl = useAdminUrl()

  const handleLogout = async () => {
    if (!(await myModal.confirm({ message: '确定要退出登录吗？' }))) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push(adminUrl('/login'))
  }

  if (!user) return null

  return (
    <div className={classes.wrapper}>
      <div className={classes.user}>
        <Group flex={1}>
          <Avatar radius="xl" size="sm">
            {user.username.charAt(0).toUpperCase()}
          </Avatar>
          <Group gap="xs" flex={1}>
            <Text size="sm" fw={500}>
              {user.username}
            </Text>
            <RoleLabel role={user.role} />
          </Group>
          <ActionIcon variant="subtle" onClick={handleLogout} title="退出登录">
            <IconLogout size={16} stroke={1.5} />
          </ActionIcon>
        </Group>
      </div>
    </div>
  )
}
