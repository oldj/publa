'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { PostList } from '@/app/(admin)/_components/PostList'
import { SafeDrawer } from '@/components/SafeDrawer'
import { NowrapBadge } from '../../_components/NowrapBadge'

import { notify } from '@/lib/notify'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Transform } from '@dnd-kit/utilities'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconGripVertical, IconPencil, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
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
  seoTitle: string
  seoDescription: string
}

const emptyForm: FormData = {
  name: '',
  slug: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
}

// 只使用 translate，忽略 scale，避免不同高度的项拖拽时出现压缩效果
function translateOnly(transform: Transform | null) {
  if (!transform) return undefined
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
}

function SortableCategoryRow({
  item,
  onEdit,
  onDelete,
  onShowPosts,
  postCountLabel,
  dragLabel,
  editLabel,
  deleteLabel,
}: {
  item: Category
  onEdit: (item: Category) => void
  onDelete: (item: Category) => void
  onShowPosts: (item: Category) => void
  postCountLabel: string
  dragLabel: string
  editLabel: string
  deleteLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="md"
      radius="md"
      shadow={isDragging ? 'md' : undefined}
      style={{
        transform: translateOnly(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: isDragging ? 'relative' : undefined,
        backgroundColor: '#fff',
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group align="center" wrap="nowrap" gap="sm" style={{ flex: 1 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            {...attributes}
            {...listeners}
            aria-label={dragLabel}
            style={{ cursor: 'grab', marginTop: 2 }}
          >
            <IconGripVertical size={18} />
          </ActionIcon>

          <div>
            <Text fw={600}>{item.name}</Text>
            <Text size="sm" c="dimmed">
              {item.slug}
            </Text>
          </div>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <NowrapBadge
            variant="light"
            style={{ cursor: 'pointer' }}
            onClick={() => onShowPosts(item)}
          >
            {postCountLabel}
          </NowrapBadge>
          <ActionIcon variant="subtle" onClick={() => onEdit(item)} aria-label={editLabel}>
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDelete(item)}
            aria-label={deleteLabel}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  )
}

export default function CategoriesPage() {
  const t = useTranslations('admin.categoriesPage')
  const tCommon = useTranslations('common')
  const [categories, setCategories] = useState<Category[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [drawerCategory, setDrawerCategory] = useState<Category | null>(null)
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)

  const showPostsByCategory = (category: Category) => {
    setDrawerCategory(category)
    openDrawer()
  }

  const handleDrawerClose = () => {
    closeDrawer()
    // 抽屉内可能删除了文章，关闭时刷新分类列表以同步文章数
    fetchCategories()
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

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
      notify({ color: 'red', message: t('validation.nameAndSlugRequired') })
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
        notify({
          color: 'green',
          message: editingId
            ? tCommon('messages.updateSuccess')
            : tCommon('messages.createSuccess'),
        })
        close()
        fetchCategories()
      } else {
        notify({ color: 'red', message: data.message || tCommon('errors.operationFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: Category) => {
    if (!(await myModal.confirm({ message: t('deleteConfirm', { name: item.name }) }))) return

    const res = await fetch(`/api/categories/${item.id}`, { method: 'DELETE' })
    const data = await res.json()

    if (data.success) {
      notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
      fetchCategories()
    } else {
      notify({ color: 'red', message: data.message || tCommon('errors.deleteFailed') })
    }
  }

  const [recounting, setRecounting] = useState(false)
  const handleRecount = async () => {
    setRecounting(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recount' }),
      })
      const data = await res.json()
      if (data.success) {
        notify({ color: 'green', message: t('messages.recountSuccess') })
        fetchCategories()
      } else {
        notify({ color: 'red', message: data.message || t('messages.recountFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setRecounting(false)
    }
  }

  const persistOrder = async (items: Category[]) => {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        ids: items.map((item) => item.id),
      }),
    })
    const json = await response.json()
    if (!json.success) {
      throw new Error(json.message || 'Reorder failed')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = categories.findIndex((item) => item.id === active.id)
    const newIndex = categories.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextItems = arrayMove(categories, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }))
    const previousItems = categories

    setCategories(nextItems)
    try {
      await persistOrder(nextItems)
    } catch {
      setCategories(previousItems)
      notify({ color: 'red', message: t('messages.reorderFailed') })
      await fetchCategories()
    }
  }

  const setField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>{t('title')}</Title>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={handleRecount}
            loading={recounting}
          >
            {t('recount')}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
            {t('new')}
          </Button>
        </Group>
      </Group>

      {categories.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text ta="center" c="dimmed">
            {t('empty')}
          </Text>
        </Paper>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={categories.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="sm">
              {categories.map((item) => (
                <SortableCategoryRow
                  key={item.id}
                  item={item}
                  onEdit={handleOpen}
                  onDelete={handleDelete}
                  onShowPosts={showPostsByCategory}
                  postCountLabel={t('postCount', { count: item.postCount })}
                  dragLabel={t('aria.drag')}
                  editLabel={t('aria.edit')}
                  deleteLabel={t('aria.delete')}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title={editingId ? t('modal.editTitle') : t('modal.createTitle')}
      >
        <TextInput
          label={t('fields.name')}
          placeholder={t('fields.namePlaceholder')}
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
        <TextInput
          label={t('fields.slug')}
          placeholder={t('fields.slugPlaceholder')}
          required
          mt="sm"
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
        />
        <Textarea
          label={t('fields.description')}
          placeholder={t('fields.descriptionPlaceholder')}
          mt="sm"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
        />
        <TextInput
          label={t('fields.seoTitle')}
          placeholder={t('fields.optionalPlaceholder')}
          mt="sm"
          value={form.seoTitle}
          onChange={(e) => setField('seoTitle', e.target.value)}
        />
        <TextInput
          label={t('fields.seoDescription')}
          placeholder={t('fields.optionalPlaceholder')}
          mt="sm"
          value={form.seoDescription}
          onChange={(e) => setField('seoDescription', e.target.value)}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={close}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {editingId ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </Group>
      </Modal>

      <SafeDrawer
        opened={drawerOpened}
        onClose={handleDrawerClose}
        position="right"
        size="80%"
        title={
          drawerCategory
            ? t('drawerTitle', { name: drawerCategory.name })
            : t('drawerFallbackTitle')
        }
      >
        {drawerCategory && (
          <PostList key={drawerCategory.id} initialCategoryId={String(drawerCategory.id)} />
        )}
      </SafeDrawer>
    </Box>
  )
}
