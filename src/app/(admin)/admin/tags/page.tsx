'use client'
import myModal from '@/components/myModals'
import adminStyles from '../../_components/AdminShell.module.scss'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'

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

export default function TagsPage() {
  const [tagList, setTagList] = useState<Tag[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)

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

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={3}>标签管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
          新建标签
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>名称</Table.Th>
              <Table.Th>Slug</Table.Th>
              <Table.Th>文章数</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tagList.map((tag) => (
              <Table.Tr key={tag.id}>
                <Table.Td>{tag.id}</Table.Td>
                <Table.Td>{tag.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {tag.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{tag.postCount}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
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
                <Table.Td colSpan={5}>
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
    </div>
  )
}
