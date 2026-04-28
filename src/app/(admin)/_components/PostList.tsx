'use client'
import { notify } from '@/lib/notify'
import {
  ActionIcon,
  CloseButton,
  Group,
  Pagination,
  SegmentedControl,
  Select,
  type SelectProps,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconChartLine,
  IconCheck,
  IconEye,
  IconPencil,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { useAdminUrl } from './AdminPathContext'
import adminStyles from './AdminShell.module.scss'
import myModal from './myModals'
import { NowrapBadge } from './NowrapBadge'
import PostTrendModal from './PostTrendModal'

interface PostItem {
  id: number
  title: string
  slug: string
  status: string
  categoryName: string | null
  viewCount: number
  commentCount: number
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

const statusColorMap: Record<string, string> = {
  draft: 'gray',
  scheduled: 'blue',
  published: 'green',
}

export interface PostListProps {
  /** 初始分类筛选 */
  initialCategoryId?: string
  /** 初始标签筛选 */
  initialTagId?: string
  /** 初始状态筛选 */
  initialStatus?: string
}

export function PostList({
  initialCategoryId = '',
  initialTagId = '',
  initialStatus = '',
}: PostListProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('admin.postList')
  const adminUrl = useAdminUrl()
  const [data, setData] = useState<PostListResult | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState(initialStatus)
  // searchInput 是输入框的即时值，search 是提交后才用于查询的值
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [tagId, setTagId] = useState(initialTagId)
  const [trendPost, setTrendPost] = useState<{ id: number; title: string } | null>(null)

  const commitSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const clearSearch = () => {
    setSearchInput('')
    if (search) {
      setSearch('')
      setPage(1)
    }
  }
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string; count: number }[]
  >([])
  const [tagOptions, setTagOptions] = useState<{ value: string; label: string; count: number }[]>(
    [],
  )

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/tags').then((r) => r.json()),
    ]).then(([catData, tagData]) => {
      if (catData.success)
        setCategoryOptions(
          catData.data.map((c: any) => ({
            value: String(c.id),
            label: c.name,
            count: c.postCount,
          })),
        )
      if (tagData.success)
        setTagOptions(
          [...tagData.data]
            .sort((a: any, b: any) => b.postCount - a.postCount)
            .map((t: any) => ({ value: String(t.id), label: t.name, count: t.postCount })),
        )
    })
  }, [])

  const renderCountOption: SelectProps['renderOption'] = ({ option, checked }) => (
    <Group gap={6} justify="space-between" wrap="nowrap" flex={1}>
      <Text span size="sm" fw={checked ? 600 : undefined}>
        {option.label}
      </Text>
      <Text size="xs" c="dimmed">
        {(option as any).count}
      </Text>
      <div style={{ flex: 1 }} />
      {checked && <IconCheck size={14} />}
    </Group>
  )

  const fetchPosts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    if (categoryId) params.set('categoryId', categoryId)
    if (tagId) params.set('tagId', tagId)

    const res = await fetch(`/api/posts?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
  }, [page, status, search, categoryId, tagId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDelete = async (id: number, title: string) => {
    if (!(await myModal.confirm({ message: t('deleteConfirm', { title }) }))) return

    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    const json = await res.json()

    if (json.success) {
      notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
      if (data && data.items.length <= 1 && page > 1) {
        setPage(page - 1)
      } else {
        fetchPosts()
      }
    } else {
      notify({ color: 'red', message: json.message || tCommon('errors.deleteFailed') })
    }
  }

  const getPreviewUrl = (post: PostItem) => {
    if (post.status === 'published' && post.slug) {
      return `/posts/${post.slug}`
    }

    return `/posts/--preview-${post.id}`
  }

  return (
    <>
      <Group mb="md" justify="space-between">
        <Group gap="sm">
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
        </Group>
        <Group gap="sm">
          <Select
            placeholder={t('categoryPlaceholder')}
            clearable
            data={categoryOptions}
            value={categoryId || null}
            onChange={(v) => {
              setCategoryId(v || '')
              setPage(1)
            }}
            renderOption={renderCountOption}
            style={{ width: 140 }}
          />
          <Select
            placeholder={t('tagPlaceholder')}
            clearable
            data={tagOptions}
            value={tagId || null}
            onChange={(v) => {
              setTagId(v || '')
              setPage(1)
            }}
            renderOption={renderCountOption}
            style={{ width: 140 }}
          />
          <TextInput
            placeholder={t('searchPlaceholder')}
            rightSectionWidth={56}
            rightSection={
              <Group gap={0} wrap="nowrap">
                <CloseButton
                  size="sm"
                  variant="transparent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSearch}
                  aria-label={t('clearSearch')}
                  style={{ visibility: searchInput ? 'visible' : 'hidden' }}
                />
                <ActionIcon variant="subtle" onClick={commitSearch} aria-label={t('search')}>
                  <IconSearch size={16} />
                </ActionIcon>
              </Group>
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSearch()
            }}
            style={{ maxWidth: 300 }}
          />
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={adminStyles.cellFill}>{t('columns.title')}</Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.category')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.status')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.views')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.trend')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.comments')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.publishedAt')}
              </Table.Th>
              <Table.Th className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                {t('columns.actions')}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.items.map((post) => {
              const stLabel =
                post.status === 'draft' ||
                post.status === 'scheduled' ||
                post.status === 'published'
                  ? tCommon(`status.${post.status}`)
                  : post.status
              const stColor = statusColorMap[post.status] || 'gray'
              const effectiveTitle = post.title || t('untitled')
              return (
                <Table.Tr key={post.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {post.pinned && (
                        <NowrapBadge size="xs" color="red">
                          {t('pinned')}
                        </NowrapBadge>
                      )}
                      <Link
                        href={adminUrl(`/posts/${post.id}`)}
                        style={{
                          color: 'inherit',
                          textDecoration: 'none',
                          fontWeight: 'normal',
                          fontSize: 'var(--mantine-font-size-sm)',
                        }}
                      >
                        {post.title || (
                          <Text span c="dimmed" inherit>
                            {t('untitled')}
                          </Text>
                        )}
                      </Link>
                      {post.status === 'published' && post.hasDraft && (
                        <NowrapBadge color="orange" variant="light" size="xs">
                          {t('modified')}
                        </NowrapBadge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Text size="sm" c="dimmed">
                      {post.categoryName || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <NowrapBadge color={stColor} variant="light">
                      {stLabel}
                    </NowrapBadge>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Text size="sm">{post.viewCount}</Text>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <ActionIcon
                      variant="subtle"
                      onClick={() => setTrendPost({ id: post.id, title: effectiveTitle })}
                      aria-label={t('trendAria', { title: effectiveTitle })}
                    >
                      <IconChartLine size={16} />
                    </ActionIcon>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Text size="sm">{post.commentCount}</Text>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Text size="sm" c="dimmed">
                      {post.publishedAt ? dayjs(post.publishedAt).format('YYYY-MM-DD HH:mm') : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={getPreviewUrl(post)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('previewAria', { title: post.title })}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        component={Link}
                        href={adminUrl(`/posts/${post.id}`)}
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
                <Table.Td colSpan={8}>
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

      <PostTrendModal post={trendPost} onClose={() => setTrendPost(null)} />
    </>
  )
}
