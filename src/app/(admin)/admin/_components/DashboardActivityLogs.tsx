'use client'

import { useCurrentUser } from '@/app/(admin)/_components/AdminCountsContext'
import adminStyles from '@/app/(admin)/_components/AdminShell.module.scss'
import { RoleLabel } from '@/app/(admin)/_components/RoleLabel'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Group,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconCopy } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

interface ActivityLog {
  id: number
  userId: number
  username: string | null
  role: string | null
  action: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const PAGE_SIZE = 20

export default function DashboardActivityLogs() {
  const t = useTranslations('admin.dashboard.activityLogs')
  const tActions = useTranslations('admin.usersPage.activityLabels')
  const tCommon = useTranslations('common')
  const currentUser = useCurrentUser()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback((p: number) => {
    fetch(`/api/activity-logs?page=${p}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.data.items)
          setTotal(json.data.total)
        }
      })
      .catch(() => {
        /* 静默忽略，避免影响仪表盘其他区块 */
      })
  }, [])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchLogs(page)
  }, [currentUser, fetchLogs, page])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const handleCopy = async (value: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(value)
      notify({ color: 'green', message: tCommon('messages.copySuccess') })
    } catch {
      notify({ color: 'red', message: tCommon('errors.operationFailed') })
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Paper withBorder p="md" radius="md" data-role="dashboard-activity-logs">
      <Stack gap="md">
        <Title order={4}>{t('title')}</Title>

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
                    <Table.Th>{t('columns.user')}</Table.Th>
                    <Table.Th>{t('columns.action')}</Table.Th>
                    <Table.Th>{t('columns.ip')}</Table.Th>
                    <Table.Th>{t('columns.userAgent')}</Table.Th>
                    <Table.Th>{t('columns.time')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {logs.map((log) => (
                    <Table.Tr key={log.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm">{log.username ?? t('unknownUser')}</Text>
                          {log.role && <RoleLabel role={log.role} size="xs" />}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                          {tActions.has(log.action as never)
                            ? tActions(log.action as never)
                            : log.action}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            {log.ipAddress || '—'}
                          </Text>
                          {log.ipAddress && (
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              onClick={() => handleCopy(log.ipAddress!)}
                            >
                              <IconCopy size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: 260 }}>
                        <Group gap={4} wrap="nowrap">
                          {log.userAgent ? (
                            <>
                              <Tooltip label={log.userAgent} multiline maw={360} withArrow>
                                <Text
                                  size="sm"
                                  c="dimmed"
                                  lineClamp={1}
                                  style={{ cursor: 'help', flex: 1, minWidth: 0 }}
                                >
                                  {log.userAgent}
                                </Text>
                              </Tooltip>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={() => handleCopy(log.userAgent!)}
                              >
                                <IconCopy size={14} />
                              </ActionIcon>
                            </>
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
                        </Text>
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
    </Paper>
  )
}
