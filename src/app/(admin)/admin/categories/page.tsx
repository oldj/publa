'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { NowrapBadge } from '../../_components/NowrapBadge'
import adminStyles from '../../_components/AdminShell.module.scss'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'

interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
  postCount: number
}

interface FormData {
  name: string
  slug: string
  description: string
  sortOrder: number
  seoTitle: string
  seoDescription: string
}

const emptyForm: FormData = {
  name: '',
  slug: '',
  description: '',
  sortOrder: 0,
  seoTitle: '',
  seoDescription: '',
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/categories')
    const data = await res.json()
    if (data.success) setCategories(data.data)
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleOpen = (category?: Category) => {
    if (category) {
      setEditingId(category.id)
      setForm({
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        sortOrder: category.sortOrder,
        seoTitle: category.seoTitle || '',
        seoDescription: category.seoDescription || '',
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
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories'
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
        fetchCategories()
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
    if (!(await myModal.confirm({ message: `确定要删除分类「${name}」吗？` }))) return

    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (data.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchCategories()
    } else {
      notify({ color: 'red', message: data.message || '删除失败' })
    }
  }

  const setField = (field: keyof FormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>分类管理</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
          新建分类
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
            {categories.map((cat) => (
              <Table.Tr key={cat.id}>
                <Table.Td>{cat.id}</Table.Td>
                <Table.Td>{cat.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {cat.slug}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NowrapBadge variant="light">{cat.postCount}</NowrapBadge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="subtle" onClick={() => handleOpen(cat)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(cat.id, cat.name)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {categories.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="md">
                    暂无分类
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title={editingId ? '编辑分类' : '新建分类'}>
        <TextInput
          label="名称"
          placeholder="分类名称"
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
        <Textarea
          label="描述"
          placeholder="分类描述（可选）"
          mt="sm"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
        />
        <NumberInput
          label="排序"
          placeholder="数字越小越靠前"
          mt="sm"
          value={form.sortOrder}
          onChange={(val) => setField('sortOrder', typeof val === 'number' ? val : 0)}
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
    </Box>
  )
}
