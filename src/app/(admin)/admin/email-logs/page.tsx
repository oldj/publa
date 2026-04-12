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
import { useTranslations } from 'next-intl'
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

const PAGE_SIZE = 50

export default function EmailLogsPage() {
  const t = useTranslations('admin.emailLogsPage')
  const tCommon = useTranslations('common')
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
    if (!(await myModal.confirm({ title: t('deleteConfirmTitle'), message: t('deleteConfirm') }))) {
      return
    }
    try {
      const res = await fetch(`/api/email-logs/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
        // 当前页只剩一条且不是第一页时，回退到上一页
        const targetPage = logs.length <= 1 && page > 1 ? page - 1 : page
        if (targetPage !== page) setPage(targetPage)
        else fetchLogs(page)
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.deleteFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Stack gap="lg" mt="md">
      <Group justify="space-between">
        <Title order={3}>{t('title')}</Title>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        {t('description')}
      </Alert>

      {logs.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {t('empty')}
        </Text>
      ) : (
        <>
          <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('columns.event')}</Table.Th>
                  <Table.Th>{t('columns.recipients')}</Table.Th>
                  <Table.Th>{t('columns.subject')}</Table.Th>
                  <Table.Th>{t('columns.status')}</Table.Th>
                  <Table.Th>{t('columns.time')}</Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <NowrapBadge variant="light" size="sm">
                        {t.has(`events.${log.eventType}` as never)
                          ? t(`events.${log.eventType}` as never)
                          : log.eventType}
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
                          {t('statuses.success')}
                        </NowrapBadge>
                      ) : (
                        <Tooltip
                          label={log.errorMessage || t('tooltips.failed')}
                          multiline
                          maw={300}
                        >
                          <NowrapBadge
                            color="red"
                            variant="light"
                            size="sm"
                            style={{ cursor: 'help' }}
                          >
                            {t('statuses.failed')}
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
