'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { NowrapBadge } from '@/app/(admin)/_components/NowrapBadge'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Alert,
  Group,
  Pagination,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconInfoCircle, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'

interface EmailLog {
  id: number
  eventType: string
  recipients: string[]
  subject: string
  status: string
  errorMessage: string | null
  createdAt: string
}

const EVENT_LABELS: Record<string, string> = {
  new_comment: '新评论',
  new_guestbook: '新留言',
  test: '测试',
}

const PAGE_SIZE = 50

export default function EmailLogsPage() {
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const currentUser = useCurrentUser()
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback((p: number) => {
    fetch(`/api/email-logs?page=${p}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.data.items)
          setTotal(json.data.total)
        }
      })
  }, [])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchLogs(page)
  }, [currentUser, fetchLogs, page])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const handleDelete = async (id: number) => {
    if (!(await myModal.confirm({ title: '删除确认', message: '确定删除这条发送记录？' }))) {
      return
    }
    try {
      const res = await fetch(`/api/email-logs/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '已删除' })
        // 当前页只剩一条且不是第一页时，回退到上一页
        const targetPage = logs.length <= 1 && page > 1 ? page - 1 : page
        if (targetPage !== page) setPage(targetPage)
        else fetchLogs(page)
      } else {
        notify({ color: 'red', message: json.message || '删除失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Stack gap="lg" mt="md">
      <Group justify="space-between">
        <Title order={3}>邮件日志</Title>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        邮件发送记录仅保留 30 天，超过 30 天的记录会被自动清理。
      </Alert>

      {logs.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          暂无发送记录
        </Text>
      ) : (
        <>
          <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>事件</Table.Th>
                  <Table.Th>收件人</Table.Th>
                  <Table.Th>主题</Table.Th>
                  <Table.Th>状态</Table.Th>
                  <Table.Th>时间</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <NowrapBadge variant="light" size="sm">
                        {EVENT_LABELS[log.eventType] || log.eventType}
                      </NowrapBadge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {log.recipients.join(', ')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {log.subject}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {log.status === 'success' ? (
                        <NowrapBadge color="green" variant="light" size="sm">
                          成功
                        </NowrapBadge>
                      ) : (
                        <Tooltip label={log.errorMessage || '发送失败'} multiline maw={300}>
                          <NowrapBadge
                            color="red"
                            variant="light"
                            size="sm"
                            style={{ cursor: 'help' }}
                          >
                            失败
                          </NowrapBadge>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleDelete(log.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </>
      )}
    </Stack>
  )
}
