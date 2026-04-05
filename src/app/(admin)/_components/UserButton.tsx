'use client'

import type { AuthUser } from '@/server/auth'
import { Avatar, Group, Text, UnstyledButton } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import classes from './UserButton.module.scss'

const roleLabels: Record<string, string> = {
  owner: '站长',
  admin: '管理员',
  editor: '编辑',
}

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
            <Text c="dimmed" size="xs">
              {roleLabels[user.role] || user.role}
            </Text>
          </div>
          <UnstyledButton onClick={handleLogout} title="退出登录">
            <IconLogout size={16} stroke={1.5} />
          </UnstyledButton>
        </Group>
      </div>
    </div>
  )
}
