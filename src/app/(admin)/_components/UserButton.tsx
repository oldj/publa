'use client'

import type { AuthUser } from '@/server/auth'
import { Avatar, Group, Text, UnstyledButton } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { RoleLabel } from './RoleLabel'
import classes from './UserButton.module.scss'

export function UserButton({ user }: { user: AuthUser | null }) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (!user) return null

  return (
    <div className={classes.wrapper}>
      <div className={classes.user}>
        <Group>
          <Avatar radius="xl" size="sm">
            {user.username.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {user.username}
            </Text>
            <RoleLabel role={user.role} />
          </div>
          <UnstyledButton onClick={handleLogout} title="退出登录">
            <IconLogout size={16} stroke={1.5} />
          </UnstyledButton>
        </Group>
      </div>
    </div>
  )
}
