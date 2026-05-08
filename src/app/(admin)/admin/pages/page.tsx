'use client'

import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import adminStyles from '@/app/(admin)/_components/AdminShell.module.scss'
import myModal from '@/app/(admin)/_components/myModals'
import { NowrapBadge } from '@/app/(admin)/_components/NowrapBadge'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Pagination,
  SegmentedControl,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconEye, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface PageItem {
  id: number
  title: string
  path: string
  status: string
  template: string
  contentType: string
  hasDraft: boolean
}

interface PageListResult {
  items: PageItem[]
  page: number
  pageSize: number
  pageCount: number
  itemCount: number
  statusCounts: Record<string, number>
}

export default function PagesAdminPage() {
  const t = useTranslations('admin.pagesPage')
  const tCommon = useTranslations('common')
  const adminUrl = useAdminUrl()
  const [data, setData] = useState<PageListResult | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const fetchPages = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)

    const res = await fetch(`/api/pages?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page, status, search])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleDelete = async (id: number, title: string) => {
    if (!(await myModal.confirm({ message: t('deleteConfirm', { title }) }))) return
    const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchPages()
      }
    }
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: tCommon('status.draft'), color: 'gray' },
    scheduled: { label: tCommon('status.scheduled'), color: 'blue' },
    published: { label: tCommon('status.published'), color: 'green' },
  }

  return (
    <Box mt="md" data-role="admin-pages-page">
      <Group justify="space-between" mb="lg">
        <Title order={3} data-role="admin-pages-page-title">
          {t('title')}
        </Title>
        <Button
          component={Link}
          href={adminUrl('/pages/new')}
          leftSection={<IconPlus size={16} />}
          data-role="admin-pages-new-button"
        >
          {t('newPage')}
        </Button>
      </Group>

      <Group mb="md" justify="space-between">
        <SegmentedControl
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          data={(() => {
            const c = data?.statusCounts ?? { draft: 0, scheduled: 0, published: 0 }
            const total = Object.values(c).reduce((a, b) => a + b, 0)
            return [
              { value: '', label: t('statusAll', { count: total }) },
              { value: 'draft', label: t('statusDraft', { count: c.draft }) },
              { value: 'scheduled', label: t('statusScheduled', { count: c.scheduled }) },
              { value: 'published', label: t('statusPublished', { count: c.published }) },
            ]
          })()}
        />
        <TextInput
          placeholder={t('searchPlaceholder')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          style={{ maxWidth: 300 }}
        />
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={adminStyles.cellFill}>{t('columns.title')}</Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.path')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.type')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.status')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.actions')}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((p) => {
              const st = statusMap[p.status] || { label: p.status, color: 'gray' }
              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Link
                        href={adminUrl(`/pages/${p.id}`)}
                        style={{
                          color: 'inherit',
                          textDecoration: 'none',
                          fontWeight: 'normal',
                          fontSize: 'var(--mantine-font-size-sm)',
                        }}
                      >
                        {p.title || (
                          <Text span c="dimmed" inherit>
                            {t('untitled')}
                          </Text>
                        )}
                      </Link>
                      {p.status === 'published' && p.hasDraft && (
                        <NowrapBadge color="orange" variant="light" size="xs">
                          {t('modified')}
                        </NowrapBadge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    {p.path ? (
                      <Text size="sm" c="dimmed">
                        /{p.path}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <NowrapBadge variant="light" size="sm">
                      {p.contentType}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <NowrapBadge color={st.color} variant="light">
                      {st.label}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={
                          p.status === 'published' && p.path ? `/${p.path}` : `/--preview-${p.id}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('previewAria', { title: p.title || t('untitled') })}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={adminUrl(`/pages/${p.id}`)}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(p.id, p.title)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {data?.items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="md">
                    {t('empty')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data && data.pageCount > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={data.pageCount} value={page} onChange={setPage} />
        </Group>
      )}
    </Box>
  )
}
