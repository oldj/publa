'use client'
import myModal from '@/components/myModals'
import adminStyles from '../../_components/AdminShell.module.scss'

import { notify } from '@/lib/notify'
import { ActionIcon, Badge, Button, Group, Table, Text, Title } from '@mantine/core'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface PageItem {
  id: number
  title: string
  path: string
  status: string
  template: string
  contentType: string
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  published: { label: '已发布', color: 'green' },
}

export default function PagesAdminPage() {
  const [pageList, setPageList] = useState<PageItem[]>([])

  const fetchPages = useCallback(async () => {
    const res = await fetch('/api/pages')
    const json = await res.json()
    if (json.success) setPageList(json.data.items)
  }, [])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleDelete = async (id: number, title: string) => {
    if (!(await myModal.confirm({ message: `确定要删除页面「${title}」吗？` }))) return
    const res = await fetch(`/api/pages/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchPages()
    }
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>页面管理</Title>
        <Button component={Link} href="/admin/pages/new" leftSection={<IconPlus size={16} />}>
          新建页面
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>标题</Table.Th>
              <Table.Th>路径</Table.Th>
              <Table.Th>类型</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pageList.map((p) => {
              const st = statusMap[p.status] || { label: p.status, color: 'gray' }
              return (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.title}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      /{p.path}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {p.contentType}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={st.color} variant="light">
                      {st.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon variant="subtle" component={Link} href={`/admin/pages/${p.id}`}>
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
            {pageList.length === 0 && (
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
    </div>
  )
}
