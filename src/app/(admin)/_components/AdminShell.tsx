'use client'

import { version } from '@/lib/version'
import type { AuthUser } from '@/server/auth'
import { AppShell, Burger, Code, Group, ScrollArea, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconGauge,
  IconMail,
  IconMessage,
  IconNotes,
  IconSettings,
  IconWorld,
} from '@tabler/icons-react'
import { AdminCountsProvider, useAdminCounts } from './AdminCountsContext'
import { useAdminUrl } from './AdminPathContext'
import classes from './AdminShell.module.scss'
import { NavLinksGroup, type NavLinksGroupProps } from './NavLinksGroup'
import { UserButton } from './UserButton'

function NavLinks({ user }: { user: AuthUser | null }) {
  const { counts } = useAdminCounts()
  const adminUrl = useAdminUrl()
  const isOwner = user?.role === 'owner'
  const isAdmin = user?.role === 'admin'

  const navData: NavLinksGroupProps[] = [
    { id: 'dashboard', label: '仪表盘', icon: IconGauge, link: adminUrl() },
    {
      id: 'content',
      label: '内容',
      icon: IconNotes,
      initiallyOpened: true,
      links: [
        { label: '文章', link: adminUrl('/posts') },
        { label: '分类', link: adminUrl('/categories') },
        { label: '标签', link: adminUrl('/tags') },
        { label: '页面', link: adminUrl('/pages') },
        { label: '附件', link: adminUrl('/attachments') },
      ],
    },
    {
      id: 'interactions',
      label: '互动',
      icon: IconMessage,
      initiallyOpened: true,
      links: [
        { label: '评论', link: adminUrl('/comments'), badge: counts?.pendingComments || 0 },
        { label: '留言', link: adminUrl('/guestbook'), badge: counts?.unreadGuestbook || 0 },
      ],
    },
    {
      id: 'site',
      label: '站点',
      icon: IconWorld,
      links: [
        ...(isOwner || isAdmin ? [{ label: '菜单', link: adminUrl('/menus') }] : []),
        ...(isOwner || isAdmin ? [{ label: '跳转', link: adminUrl('/redirects') }] : []),
      ],
    },
    ...(isOwner || isAdmin
      ? [
          {
            id: 'email',
            label: '邮件',
            icon: IconMail,
            links: [
              { label: '邮件通知', link: adminUrl('/email') },
              { label: '邮件日志', link: adminUrl('/email-logs') },
            ],
          },
        ]
      : []),
    {
      id: 'system',
      label: '系统',
      icon: IconSettings,
      links: [
        { label: '用户', link: adminUrl('/users') },
        ...(isOwner || isAdmin ? [{ label: '设置', link: adminUrl('/settings') }] : []),
        ...(isOwner || isAdmin ? [{ label: '导入导出', link: adminUrl('/import-export') }] : []),
      ],
    },
  ].filter((item) => !item.links || item.links.length > 0)

  return (
    <>
      {navData.map((item) => (
        <NavLinksGroup {...item} key={item.id} />
      ))}
    </>
  )
}

export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: AuthUser | null
}) {
  const [opened, { toggle }] = useDisclosure()

  return (
    <AdminCountsProvider user={user}>
      <AppShell
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Navbar p="md" className={classes.navbar}>
          <div className={classes.header}>
            <Group justify="space-between">
              <Text fw={700} size="lg">
                Publa
              </Text>
              <Code fw={700}>{version}</Code>
            </Group>
          </div>

          <ScrollArea className={classes.links}>
            <div className={classes.linksInner}>
              <NavLinks user={user} />
            </div>
          </ScrollArea>

          <div className={classes.footer}>
            <UserButton user={user} />
          </div>
        </AppShell.Navbar>

        <AppShell.Header hiddenFrom="sm">
          <Group h="100%" px="md">
            <Burger opened={opened} onClick={toggle} size="sm" />
            <Text fw={700}>Publa</Text>
          </Group>
        </AppShell.Header>

        <AppShell.Main pt={0} pb={60}>
          {children}
        </AppShell.Main>
      </AppShell>
    </AdminCountsProvider>
  )
}
