'use client'
import myModal from '@/components/myModals'
import { useAdminCounts } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { IconCheck, IconMail, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

interface GuestbookItem {
  id: number
  authorName: string
  authorEmail: string | null
  content: string
  status: string
  createdAt: string
}

interface GuestbookDetail {
  id: number
  authorName: string
  authorEmail: string | null
  authorWebsite: string | null
  content: string
  ipAddress: string | null
  userAgent: string | null
  status: string
  createdAt: string
}

const statusMap: Record<string, { label: string; color: string }> = {
  unread: { label: '未读', color: 'orange' },
  read: { label: '已读', color: 'gray' },
}

export default function GuestbookAdminPage() {
  const { refreshCounts } = useAdminCounts()
  const [data, setData] = useState<{
    items: GuestbookItem[]
    pageCount: number
    itemCount: number
  } | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | null>(null)
  const [detail, setDetail] = useState<GuestbookDetail | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' })
    if (status) params.set('status', status)
    const res = await fetch(`/api/admin/guestbook?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page, status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openDetail = async (msg: GuestbookItem) => {
    const res = await fetch(`/api/admin/guestbook?id=${msg.id}`)
    const json = await res.json()
    if (json.success) {
      const data = json.data
      // 自动标记为已读
      if (data.status === 'unread') {
        data.status = 'read'
        handleToggleRead(msg.id, 'unread', true)
      }
      setDetail(data)
      setDrawerOpened(true)
    }
  }

  const handleToggleRead = async (id: number, currentStatus: string, silent = false) => {
    const newAction = currentStatus === 'unread' ? undefined : 'unread'
    const res = await fetch('/api/admin/guestbook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: newAction }),
    })
    const json = await res.json()
    if (json.success) {
      const newStatus = currentStatus === 'unread' ? 'read' : 'unread'
      if (!silent) {
        notify({ color: 'green', message: newStatus === 'read' ? '已标记为已读' : '已标记为未读' })
      }
      fetchData()
      refreshCounts()
      if (detail?.id === id) {
        setDetail({ ...detail, status: newStatus })
      }
    }
  }

  const handleMarkAllRead = async () => {
    const res = await fetch('/api/admin/guestbook', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readAll' }),
    })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '全部标记为已读' })
      fetchData()
      refreshCounts()
    }
  }

  const handleDelete = async (id: number) => {
    if (!(await myModal.confirm({ message: '确定要删除此留言吗？' }))) return
    const res = await fetch(`/api/admin/guestbook?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchData()
      refreshCounts()
      if (detail?.id === id) setDrawerOpened(false)
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>留言管理</Title>
        <Group gap="sm">
          <Button variant="light" size="xs" onClick={handleMarkAllRead}>
            全部已读
          </Button>
          <Select
            placeholder="全部状态"
            clearable
            data={[
              { value: 'unread', label: '未读' },
              { value: 'read', label: '已读' },
            ]}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            style={{ width: 120 }}
          />
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>作者</Table.Th>
              <Table.Th>内容</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>时间</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((msg) => {
              const st = statusMap[msg.status] || { label: msg.status, color: 'gray' }
              return (
                <Table.Tr
                  key={msg.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openDetail(msg)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {msg.authorName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {msg.authorEmail || ''}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 400 }}>
                    <Text size="sm" lineClamp={2}>
                      {msg.content}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={st.color} variant="light">
                      {st.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {dayjs(msg.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                      <ActionIcon
                        variant="subtle"
                        color={msg.status === 'unread' ? 'green' : 'orange'}
                        onClick={() => handleToggleRead(msg.id, msg.status)}
                        title={msg.status === 'unread' ? '标记为已读' : '标记为未读'}
                      >
                        {msg.status === 'unread' ? <IconCheck size={16} /> : <IconMail size={16} />}
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(msg.id)}>
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
                    暂无留言
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data && (
        <Group justify="center" mt="md" gap="md">
          {data.itemCount > 0 && (
            <Text size="sm" c="dimmed">
              共 {data.itemCount} 条
            </Text>
          )}
          {data.pageCount > 1 && (
            <Pagination total={data.pageCount} value={page} onChange={setPage} />
          )}
        </Group>
      )}

      {/* 留言详情 Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title="留言详情"
        position="right"
        size="lg"
      >
        {detail && (
          <Stack gap="md">
            {/* 留言内容 */}
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {detail.authorName}
                </Text>
                <Badge color={statusMap[detail.status]?.color || 'gray'} variant="light">
                  {statusMap[detail.status]?.label || detail.status}
                </Badge>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {detail.content}
              </Text>
            </div>

            <Divider />

            {/* 元信息 */}
            <Stack gap={4}>
              {detail.authorEmail && (
                <Text size="xs" c="dimmed">
                  邮箱：{detail.authorEmail}
                </Text>
              )}
              {detail.authorWebsite && (
                <Text size="xs" c="dimmed">
                  网站：{detail.authorWebsite}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                时间：{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
              {detail.ipAddress && (
                <Text size="xs" c="dimmed">
                  IP：{detail.ipAddress}
                </Text>
              )}
              {detail.userAgent && (
                <Text size="xs" c="dimmed" lineClamp={2}>
                  UA：{detail.userAgent}
                </Text>
              )}
            </Stack>

            <Divider />

            {/* 操作按钮 */}
            <Group>
              <Button
                variant="light"
                color={detail.status === 'unread' ? 'green' : 'orange'}
                size="sm"
                leftSection={
                  detail.status === 'unread' ? <IconCheck size={16} /> : <IconMail size={16} />
                }
                onClick={() => handleToggleRead(detail.id, detail.status)}
              >
                {detail.status === 'unread' ? '标记已读' : '标记未读'}
              </Button>
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={() => handleDelete(detail.id)}
              >
                删除
              </Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </div>
  )
}
