'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { useAdminCounts } from '../../_components/AdminCountsContext'
import adminStyles from '../../_components/AdminShell.module.scss'
import { NowrapBadge } from '../../_components/NowrapBadge'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
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
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface AuthorStats {
  approved: number
  rejected: number
  total: number
}

interface CommentItem {
  id: number
  contentId: number
  parentId: number | null
  authorName: string
  authorEmail: string | null
  content: string
  status: string
  createdAt: string
  contentTitle: string | null
  contentSlug: string | null
  authorStats: AuthorStats | null
  childCount: number
}

interface CommentDetail {
  id: number
  contentId: number
  parentId: number | null
  authorName: string
  authorEmail: string | null
  authorWebsite: string | null
  content: string
  ipAddress: string | null
  userAgent: string | null
  status: string
  createdAt: string
  contentTitle: string | null
  contentSlug: string | null
  parentComment: {
    id: number
    authorName: string
    authorEmail: string | null
    content: string
    status: string
    createdAt: string
  } | null
  childComments: {
    id: number
    authorName: string
    authorEmail: string | null
    content: string
    status: string
    createdAt: string
  }[]
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
}

export default function CommentsPage() {
  const { refreshCounts } = useAdminCounts()
  const [data, setData] = useState<{
    items: CommentItem[]
    pageCount: number
    itemCount: number
  } | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<string | null>(null)
  const [detail, setDetail] = useState<CommentDetail | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)

  const fetchComments = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' })
    if (status) params.set('status', status)
    const res = await fetch(`/api/admin/comments?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page, status])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const openDetail = async (id: number) => {
    const res = await fetch(`/api/comments/${id}`)
    const json = await res.json()
    if (json.success) {
      setDetail(json.data)
      setDrawerOpened(true)
    }
  }

  const handleModerate = async (id: number, action: 'approved' | 'rejected') => {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: action === 'approved' ? '已通过' : '已拒绝' })
      fetchComments()
      refreshCounts()
      // 更新 drawer 中的状态
      if (detail?.id === id) {
        setDetail({ ...detail, status: action })
      }
    } else {
      notify({ color: 'red', message: json.message || '操作失败' })
    }
  }

  const handleDelete = async (id: number, childCount?: number) => {
    const message = childCount
      ? `确定要删除此评论吗？其下的 ${childCount} 条回复也会一并删除。`
      : '确定要删除此评论吗？'
    if (!(await myModal.confirm({ message }))) return
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchComments()
      }
      refreshCounts()
      if (detail?.id === id) setDrawerOpened(false)
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>评论管理</Title>
        <Select
          placeholder="全部状态"
          clearable
          data={[
            { value: 'pending', label: '待审核' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已拒绝' },
          ]}
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          style={{ width: 140 }}
        />
      </Group>

      <Table.ScrollContainer minWidth={800} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>作者</Table.Th>
              <Table.Th>内容</Table.Th>
              <Table.Th>文章</Table.Th>
              <Table.Th>统计</Table.Th>
              <Table.Th>状态</Table.Th>
              <Table.Th>时间</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((c) => {
              const st = statusMap[c.status] || { label: c.status, color: 'gray' }
              return (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c.id)}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {c.authorName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {c.authorEmail || ''}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 300 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" lineClamp={2} style={{ flex: '1 1 0', minWidth: 0 }}>
                        {c.content}
                      </Text>
                      {c.childCount > 0 && (
                        <NowrapBadge
                          variant="light"
                          color="blue"
                          size="sm"
                          style={{ flexShrink: 0 }}
                        >
                          {c.childCount} 回复
                        </NowrapBadge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 160 }}>
                    <Text size="sm" lineClamp={1} c="dimmed">
                      {c.contentTitle || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {c.authorStats ? (
                      <Text size="sm" c="dimmed">
                        <Text span c="green">
                          {c.authorStats.approved}
                        </Text>
                        /
                        <Text span c="red">
                          {c.authorStats.rejected}
                        </Text>
                        /{c.authorStats.total}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                    <NowrapBadge color={st.color} variant="light">
                      {st.label}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {dayjs(c.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group
                      gap="xs"
                      wrap="nowrap"
                      justify="flex-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.status !== 'approved' && (
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => handleModerate(c.id, 'approved')}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                      )}
                      {c.status !== 'rejected' && (
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          onClick={() => handleModerate(c.id, 'rejected')}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(c.id, c.childCount)}
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
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="md">
                    暂无评论
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

      {/* 评论详情 Drawer */}
      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title="评论详情"
        position="right"
        size="lg"
      >
        {detail && (
          <Stack gap="md">
            {/* 文章信息 */}
            <div>
              <Text size="sm" c="dimmed">
                文章
              </Text>
              {detail.contentSlug ? (
                <Text
                  component={Link}
                  href={`/posts/${detail.contentSlug}`}
                  target="_blank"
                  size="sm"
                  fw={500}
                  c="blue"
                  td="underline"
                >
                  {detail.contentTitle}
                </Text>
              ) : (
                <Text size="sm">{detail.contentTitle || '-'}</Text>
              )}
            </div>

            <Divider />

            {/* 父评论 */}
            {detail.parentComment && (
              <>
                <div>
                  <Text size="sm" c="dimmed" mb={4}>
                    回复的评论
                  </Text>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 6,
                      border: '1px solid var(--mantine-color-gray-3)',
                      background: 'var(--mantine-color-gray-0)',
                    }}
                  >
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={500}>
                        {detail.parentComment.authorName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {dayjs(detail.parentComment.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </Group>
                    <Text size="sm">{detail.parentComment.content}</Text>
                  </div>
                </div>
                <Divider />
              </>
            )}

            {/* 评论内容 */}
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={500}>
                  {detail.authorName}
                </Text>
                <NowrapBadge color={statusMap[detail.status]?.color || 'gray'} variant="light">
                  {statusMap[detail.status]?.label || detail.status}
                </NowrapBadge>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {detail.content}
              </Text>
            </div>

            {/* 子评论 */}
            {detail.childComments.length > 0 && (
              <>
                <Divider />
                <div>
                  <Text size="sm" c="dimmed" mb={4}>
                    回复（{detail.childComments.length}）
                  </Text>
                  <Stack gap="xs">
                    {detail.childComments.map((child) => {
                      const childSt = statusMap[child.status] || {
                        label: child.status,
                        color: 'gray',
                      }
                      return (
                        <div
                          key={child.id}
                          style={{
                            padding: 12,
                            borderRadius: 6,
                            border: '1px solid var(--mantine-color-gray-3)',
                            background: 'var(--mantine-color-gray-0)',
                          }}
                        >
                          <Group justify="space-between" mb={4}>
                            <Group gap="xs">
                              <Text size="sm" fw={500}>
                                {child.authorName}
                              </Text>
                              <NowrapBadge color={childSt.color} variant="light" size="xs">
                                {childSt.label}
                              </NowrapBadge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              {dayjs(child.createdAt).format('YYYY-MM-DD HH:mm')}
                            </Text>
                          </Group>
                          <Text size="sm">{child.content}</Text>
                        </div>
                      )
                    })}
                  </Stack>
                </div>
              </>
            )}

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
              {detail.status !== 'approved' && (
                <Button
                  variant="light"
                  color="green"
                  size="sm"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => handleModerate(detail.id, 'approved')}
                >
                  通过
                </Button>
              )}
              {detail.status !== 'rejected' && (
                <Button
                  variant="light"
                  color="orange"
                  size="sm"
                  leftSection={<IconX size={16} />}
                  onClick={() => handleModerate(detail.id, 'rejected')}
                >
                  拒绝
                </Button>
              )}
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={() => handleDelete(detail.id, detail.childComments.length)}
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
