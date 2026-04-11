'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { PostList } from '@/app/(admin)/_components/PostList'
import adminStyles from '../../_components/AdminShell.module.scss'
import { NowrapBadge } from '../../_components/NowrapBadge'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Group,
  Modal,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface Tag {
  id: number
  name: string
  slug: string
  seoTitle: string | null
  seoDescription: string | null
  postCount: number
}

interface FormData {
  name: string
  slug: string
  seoTitle: string
  seoDescription: string
}

const emptyForm: FormData = {
  name: '',
  slug: '',
  seoTitle: '',
  seoDescription: '',
}

type SortKey = 'name' | 'slug' | 'postCount'

export default function TagsPage() {
  const [tagList, setTagList] = useState<Tag[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('postCount')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [drawerTag, setDrawerTag] = useState<Tag | null>(null)
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)

  const showPostsByTag = (tag: Tag) => {
    setDrawerTag(tag)
    openDrawer()
  }

  const handleDrawerClose = () => {
    closeDrawer()
    // 抽屉内可能删除了文章，关闭时刷新标签列表以同步文章数
    fetchTags()
  }

  const sortedTags = useMemo(() => {
    return [...tagList].sort((a, b) => {
      let cmp: number
      if (sortBy === 'postCount') {
        cmp = a.postCount - b.postCount
      } else {
        cmp = a[sortBy].localeCompare(b[sortBy], 'zh')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tagList, sortBy, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(key === 'postCount' ? 'desc' : 'asc')
    }
  }

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags')
    const data = await res.json()
    if (data.success) setTagList(data.data)
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const handleOpen = (tag?: Tag) => {
    if (tag) {
      setEditingId(tag.id)
      setForm({
        name: tag.name,
        slug: tag.slug,
        seoTitle: tag.seoTitle || '',
        seoDescription: tag.seoDescription || '',
      })
    } else {
      setEditingId(null)
      setForm(emptyForm)
    }
    open()
  }

  const handleSubmit = async () => {
    if (!form.name || !form.slug) {
      notify({ color: 'red', message: '名称和 slug 不能为空' })
      return
    }

    setLoading(true)
    try {
      const url = editingId ? `/api/tags/${editingId}` : '/api/tags'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (data.success) {
        notify({ color: 'green', message: editingId ? '更新成功' : '创建成功' })
        close()
        fetchTags()
      } else {
        notify({ color: 'red', message: data.message || '操作失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!(await myModal.confirm({ message: `确定要删除标签「${name}」吗？` }))) return

    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (data.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchTags()
    } else {
      notify({ color: 'red', message: data.message || '删除失败' })
    }
  }

  const setField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const [recounting, setRecounting] = useState(false)
  const handleRecount = async () => {
    setRecounting(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recount' }),
      })
      const data = await res.json()
      if (data.success) {
        notify({ color: 'green', message: '重新计数成功' })
        fetchTags()
      } else {
        notify({ color: 'red', message: data.message || '重新计数失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setRecounting(false)
    }
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>标签管理</Title>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={handleRecount}
            loading={recounting}
          >
            重新计数
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
            新建标签
          </Button>
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {(
                [
                  ['name', '名称'],
                  ['slug', 'Slug'],
                  ['postCount', '文章数'],
                ] as const
              ).map(([key, label]) => (
                <Table.Th key={key}>
                  <UnstyledButton onClick={() => toggleSort(key)}>
                    <Group gap={4} wrap="nowrap">
                      <Text fw={700} size="sm">
                        {label}
                      </Text>
                      {sortBy === key &&
                        (sortDir === 'asc' ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        ))}
                    </Group>
                  </UnstyledButton>
                </Table.Th>
              ))}
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedTags.map((tag) => (
              <Table.Tr key={tag.id}>
                <Table.Td>{tag.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {tag.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NowrapBadge
                    variant="light"
                    style={{ cursor: 'pointer' }}
                    onClick={() => showPostsByTag(tag)}
                  >
                    {tag.postCount}
                  </NowrapBadge>
                </Table.Td>
                <Table.Td className={clsx(adminStyles.cellFit, adminStyles.cellCenter)}>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon variant="subtle" onClick={() => handleOpen(tag)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(tag.id, tag.name)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {tagList.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="md">
                    暂无标签
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title={editingId ? '编辑标签' : '新建标签'}>
        <TextInput
          label="名称"
          placeholder="标签名称"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
        <TextInput
          label="Slug"
          placeholder="url-slug"
          required
          mt="sm"
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
        />
        <TextInput
          label="SEO 标题"
          placeholder="可选"
          mt="sm"
          value={form.seoTitle}
          onChange={(e) => setField('seoTitle', e.target.value)}
        />
        <TextInput
          label="SEO 描述"
          placeholder="可选"
          mt="sm"
          value={form.seoDescription}
          onChange={(e) => setField('seoDescription', e.target.value)}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {editingId ? '保存' : '创建'}
          </Button>
        </Group>
      </Modal>

      <Drawer
        opened={drawerOpened}
        onClose={handleDrawerClose}
        position="right"
        size="80%"
        title={drawerTag ? `标签「${drawerTag.name}」下的文章` : '文章列表'}
      >
        {drawerTag && <PostList key={drawerTag.id} initialTagId={String(drawerTag.id)} />}
      </Drawer>
    </Box>
  )
}
