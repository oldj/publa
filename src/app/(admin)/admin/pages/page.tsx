'use client'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import myModal from '@/app/(admin)/_components/myModals'
import adminStyles from '../../_components/AdminShell.module.scss'

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

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  scheduled: { label: '定时', color: 'blue' },
  published: { label: '已发布', color: 'green' },
}

export default function PagesAdminPage() {
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
    if (!(await myModal.confirm({ message: `确定要删除页面「${title}」吗？` }))) return
    const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchPages()
      }
    }
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>页面管理</Title>
        <Button component={Link} href={adminUrl('/pages/new')} leftSection={<IconPlus size={16} />}>
          新建页面
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
              { value: '', label: `全部 (${total})` },
              { value: 'draft', label: `草稿 (${c.draft})` },
              { value: 'scheduled', label: `定时 (${c.scheduled})` },
              { value: 'published', label: `已发布 (${c.published})` },
            ]
          })()}
        />
        <TextInput
          placeholder="搜索标题或路径..."
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
              <Table.Th className={adminStyles.cellFill}>标题</Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                路径
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                类型
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                状态
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                操作
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
                            (无标题)
                          </Text>
                        )}
                      </Link>
                      {p.status === 'published' && p.hasDraft && (
                        <NowrapBadge color="orange" variant="light" size="xs">
                          已修改
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
                        aria-label={`查看页面《${p.title}》`}
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
                    暂无页面
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
