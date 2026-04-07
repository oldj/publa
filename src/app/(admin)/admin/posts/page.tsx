'use client'
import myModal from '@/app/(admin)/_components/myModals'
import adminStyles from '../../_components/AdminShell.module.scss'

import { NowrapBadge } from '@/app/(admin)/_components/NowrapBadge'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
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
import dayjs from 'dayjs'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface PostItem {
  id: number
  title: string
  slug: string
  status: string
  categoryName: string | null
  viewCount: number
  pinned: boolean
  hasDraft: boolean
  publishedAt: string | null
  createdAt: string
}

interface PostListResult {
  items: PostItem[]
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

export default function PostsPage() {
  const [data, setData] = useState<PostListResult | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)

    const res = await fetch(`/api/posts?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page, status, search])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDelete = async (id: number, title: string) => {
    if (!(await myModal.confirm({ message: `确定要删除文章「${title}」吗？` }))) return

    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    const json = await res.json()

    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchPosts()
      }
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  const getPreviewUrl = (post: PostItem) => {
    if (post.status === 'published' && post.slug) {
      return `/posts/${post.slug}`
    }

    return `/posts/--preview-${post.id}`
  }

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>文章管理</Title>
        <Button component={Link} href="/admin/posts/new" leftSection={<IconPlus size={16} />}>
          新建文章
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
          placeholder="搜索标题或 slug..."
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
              <Table.Th className={adminStyles.cellFit}>分类</Table.Th>
              <Table.Th className={adminStyles.cellFit}>状态</Table.Th>
              <Table.Th className={adminStyles.cellFit}>浏览</Table.Th>
              <Table.Th className={adminStyles.cellFit}>发布时间</Table.Th>
              <Table.Th className={adminStyles.cellFit}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((post) => {
              const st = statusMap[post.status] || { label: post.status, color: 'gray' }
              return (
                <Table.Tr key={post.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {post.pinned && (
                        <NowrapBadge size="xs" color="red">
                          置顶
                        </NowrapBadge>
                      )}
                      <Link
                        href={`/admin/posts/${post.id}`}
                        style={{
                          color: 'inherit',
                          textDecoration: 'none',
                          fontWeight: 500,
                          fontSize: 'var(--mantine-font-size-sm)',
                        }}
                      >
                        {post.title || (
                          <Text span c="dimmed" inherit>
                            (无标题)
                          </Text>
                        )}
                      </Link>
                      {post.status === 'published' && post.hasDraft && (
                        <NowrapBadge color="orange" variant="light" size="xs">
                          已修改
                        </NowrapBadge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td className={adminStyles.cellFit}>
                    <Text size="sm" c="dimmed">
                      {post.categoryName || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td className={adminStyles.cellFit}>
                    <NowrapBadge color={st.color} variant="light">
                      {st.label}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td className={adminStyles.cellFit}>
                    <Text size="sm">{post.viewCount}</Text>
                  </Table.Td>
                  <Table.Td className={adminStyles.cellFit}>
                    <Text size="sm" c="dimmed">
                      {post.publishedAt ? dayjs(post.publishedAt).format('YYYY-MM-DD HH:mm') : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td className={adminStyles.cellFit}>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={getPreviewUrl(post)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`查看文章《${post.title}》`}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={`/admin/posts/${post.id}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(post.id, post.title)}
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
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">
                    暂无文章
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
    </div>
  )
}
