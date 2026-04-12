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
import { useTranslations } from 'next-intl'
import { AdminCountsProvider, useAdminCounts } from './AdminCountsContext'
import { useAdminUrl } from './AdminPathContext'
import classes from './AdminShell.module.scss'
import { NavLinksGroup, type NavLinksGroupProps } from './NavLinksGroup'
import { UserButton } from './UserButton'

function NavLinks({ user }: { user: AuthUser | null }) {
  const t = useTranslations('admin.shell')
  const { counts } = useAdminCounts()
  const adminUrl = useAdminUrl()
  const isOwner = user?.role === 'owner'
  const isAdmin = user?.role === 'admin'

  const navData: NavLinksGroupProps[] = [
    { id: 'dashboard', label: t('dashboard'), icon: IconGauge, link: adminUrl() },
    {
      id: 'content',
      label: t('content'),
      icon: IconNotes,
      initiallyOpened: true,
      links: [
        { id: 'posts', label: t('posts'), link: adminUrl('/posts') },
        { id: 'categories', label: t('categories'), link: adminUrl('/categories') },
        { id: 'tags', label: t('tags'), link: adminUrl('/tags') },
        { id: 'pages', label: t('pages'), link: adminUrl('/pages') },
        { id: 'attachments', label: t('attachments'), link: adminUrl('/attachments') },
      ],
    },
    {
      id: 'interactions',
      label: t('interactions'),
      icon: IconMessage,
      initiallyOpened: true,
      links: [
        {
          id: 'comments',
          label: t('comments'),
          link: adminUrl('/comments'),
          badge: counts?.pendingComments || 0,
        },
        {
          id: 'guestbook',
          label: t('guestbook'),
          link: adminUrl('/guestbook'),
          badge: counts?.unreadGuestbook || 0,
        },
      ],
    },
    {
      id: 'site',
      label: t('site'),
      icon: IconWorld,
      links: [
        ...(isOwner || isAdmin
          ? [{ id: 'menus', label: t('menus'), link: adminUrl('/menus') }]
          : []),
        ...(isOwner || isAdmin
          ? [{ id: 'redirects', label: t('redirects'), link: adminUrl('/redirects') }]
          : []),
        ...(isOwner || isAdmin
          ? [{ id: 'themes', label: t('themes'), link: adminUrl('/themes') }]
          : []),
      ],
    },
    ...(isOwner || isAdmin
      ? [
          {
            id: 'email',
            label: t('email'),
            icon: IconMail,
            links: [
              { id: 'email-notify', label: t('emailNotify'), link: adminUrl('/email') },
              { id: 'email-logs', label: t('emailLogs'), link: adminUrl('/email-logs') },
            ],
          },
        ]
      : []),
    {
      id: 'system',
      label: t('system'),
      icon: IconSettings,
      links: [
        { id: 'users', label: t('users'), link: adminUrl('/users') },
        ...(isOwner || isAdmin
          ? [{ id: 'settings', label: t('settings'), link: adminUrl('/settings') }]
          : []),
        ...(isOwner || isAdmin
          ? [{ id: 'import-export', label: t('importExport'), link: adminUrl('/import-export') }]
          : []),
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

          <ScrollArea className={classes.links} data-role="admin-nav">
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
