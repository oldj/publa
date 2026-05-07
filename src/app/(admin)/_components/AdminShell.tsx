'use client'

import { notify } from '@/lib/notify'
import { version } from '@/lib/version'
import type { AuthUser } from '@/server/auth'
import {
  AppShell,
  Burger,
  Button,
  Code,
  Group,
  Modal,
  ScrollArea,
  Text,
  TextInput,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconEdit,
  IconGauge,
  IconMail,
  IconMessage,
  IconNotes,
  IconSettings,
  IconWorld,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { AdminCountsProvider, useAdminCounts } from './AdminCountsContext'
import { useAdminUrl } from './AdminPathContext'
import classes from './AdminShell.module.scss'
import { NavLinksGroup, type NavLinksGroupProps } from './NavLinksGroup'
import { useSiteShortTitle } from './SiteShortTitleContext'
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
          ? [{ id: 'appearance', label: t('appearance'), link: adminUrl('/appearance') }]
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
  const { siteShortTitle, setSiteShortTitle } = useSiteShortTitle()
  const t = useTranslations('admin.shell')
  const tCommon = useTranslations('common')
  const canEdit = user?.role === 'owner' || user?.role === 'admin'

  // 编辑站点简称
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [editValue, setEditValue] = useState(siteShortTitle)
  const [saving, setSaving] = useState(false)

  const handleOpenEdit = () => {
    setEditValue(siteShortTitle === 'Publa' ? '' : siteShortTitle)
    openEdit()
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteShortTitle: trimmed }),
      })
      const json = await res.json()
      if (json.success) {
        setSiteShortTitle(trimmed || 'Publa')
        closeEdit()
        notify({ color: 'green', message: tCommon('save.success') })
      } else {
        notify({ color: 'red', message: json.message || tCommon('save.failed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setSaving(false)
    }
  }

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
            <Group justify="space-between" gap="4">
              {canEdit ? (
                <Group
                  gap={8}
                  className={classes.titleGroup}
                  wrap="nowrap"
                  onClick={handleOpenEdit}
                  data-role="admin-site-title"
                >
                  <Text fw={700} size="lg" className={classes.titleText}>
                    {siteShortTitle}
                  </Text>
                  <IconEdit size={16} className={classes.editIcon} />
                </Group>
              ) : (
                <Text fw={700} size="lg" data-role="admin-site-title">
                  {siteShortTitle}
                </Text>
              )}
              <a
                href="https://github.com/oldj/publa"
                target="_blank"
                rel="noopener noreferrer"
                className={classes.versionLink}
              >
                <Code fw={700}>{version}</Code>
              </a>
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
            <Text fw={700}>{siteShortTitle}</Text>
          </Group>
        </AppShell.Header>

        <AppShell.Main pt={0} pb={60}>
          {children}
        </AppShell.Main>
      </AppShell>

      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title={t('editSiteShortTitle')}
        centered
        size="sm"
        data-role="admin-site-title-modal"
      >
        <TextInput
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.slice(0, 30))}
          maxLength={30}
          placeholder="Publa"
          label={t('siteShortTitleLabel')}
          data-role="admin-site-title-input"
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeEdit}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving} data-role="admin-site-title-save">
            {tCommon('actions.save')}
          </Button>
        </Group>
      </Modal>
    </AdminCountsProvider>
  )
}
