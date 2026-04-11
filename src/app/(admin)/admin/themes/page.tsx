'use client'

import myModal from '@/app/(admin)/_components/myModals'
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
  Checkbox,
  Grid,
  Group,
  Paper,
  Radio,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconGripVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminUrl } from '../../_components/AdminPathContext'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import { PageHeader } from '../../_components/PageHeader'
import { StyleDrawer, type StyleFormInitial, type StyleKind } from './StyleDrawer'

interface Theme {
  id: number
  name: string
  css: string
  sortOrder: number
  builtinKey: string | null
}

interface CustomStyle {
  id: number
  name: string
  css: string
  sortOrder: number
}

function translateOnly(transform: Transform | null) {
  if (!transform) return undefined
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
}

function SortableThemeRow({
  theme,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  theme: Theme
  selected: boolean
  onSelect: (id: number) => void
  onEdit: (theme: Theme) => void
  onDelete: (theme: Theme) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: theme.id,
  })
  const isBuiltin = Boolean(theme.builtinKey)

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
            aria-label="拖拽排序"
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={18} />
          </ActionIcon>

          <Radio
            checked={selected}
            onChange={() => onSelect(theme.id)}
            label={
              <Group gap="xs">
                <Text fw={600}>{theme.name}</Text>
                {isBuiltin && (
                  <Text size="xs" c="dimmed">
                    （内置）
                  </Text>
                )}
              </Group>
            }
          />
        </Group>

        {!isBuiltin && (
          <Group gap="xs" wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => onEdit(theme)} aria-label="编辑主题">
              <IconPencil size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onDelete(theme)}
              aria-label="删除主题"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </Paper>
  )
}

function SortableCustomStyleRow({
  item,
  checked,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: CustomStyle
  checked: boolean
  onToggle: (id: number) => void
  onEdit: (item: CustomStyle) => void
  onDelete: (item: CustomStyle) => void
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
            aria-label="拖拽排序"
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={18} />
          </ActionIcon>

          <Checkbox
            checked={checked}
            onChange={() => onToggle(item.id)}
            label={<Text fw={600}>{item.name}</Text>}
          />
        </Group>

        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="subtle" onClick={() => onEdit(item)} aria-label="编辑">
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDelete(item)}
            aria-label="删除"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  )
}

export default function ThemesPage() {
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const currentUser = useCurrentUser()
  const [themes, setThemes] = useState<Theme[]>([])
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([])
  const [activeThemeId, setActiveThemeId] = useState<number | null>(null)
  const [activeCustomStyleIds, setActiveCustomStyleIds] = useState<number[]>([])
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
  const [drawerKind, setDrawerKind] = useState<StyleKind>('theme')
  const [drawerInitial, setDrawerInitial] = useState<StyleFormInitial | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchAll = useCallback(async () => {
    const [themesRes, stylesRes, settingsRes] = await Promise.all([
      fetch('/api/themes').then((r) => r.json()),
      fetch('/api/custom-styles').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
    if (themesRes.success) setThemes(themesRes.data)
    if (stylesRes.success) setCustomStyles(stylesRes.data)
    if (settingsRes.success) {
      const s = settingsRes.data as Record<string, unknown>
      setActiveThemeId(typeof s.activeThemeId === 'number' ? s.activeThemeId : null)
      setActiveCustomStyleIds(Array.isArray(s.activeCustomStyleIds) ? (s.activeCustomStyleIds as number[]) : [])
    }
  }, [])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchAll()
  }, [currentUser, fetchAll])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const saveActiveSettings = async (patch: Record<string, unknown>) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.message || '保存失败')
    }
  }

  const handleSelectTheme = async (id: number) => {
    const previous = activeThemeId
    setActiveThemeId(id)
    try {
      await saveActiveSettings({ activeThemeId: id })
      notify({ color: 'green', message: '已切换主题' })
    } catch (err) {
      setActiveThemeId(previous)
      notify({ color: 'red', message: err instanceof Error ? err.message : '切换失败' })
    }
  }

  const handleToggleCustomStyle = async (id: number) => {
    const exists = activeCustomStyleIds.includes(id)
    const next = exists
      ? activeCustomStyleIds.filter((x) => x !== id)
      : [...activeCustomStyleIds, id]
    const previous = activeCustomStyleIds
    setActiveCustomStyleIds(next)
    try {
      await saveActiveSettings({ activeCustomStyleIds: next })
      const item = customStyles.find((s) => s.id === id)
      const label = item ? `「${item.name}」` : ''
      notify({
        color: 'green',
        message: exists ? `已停用自定义 CSS${label}` : `已启用自定义 CSS${label}`,
      })
    } catch (err) {
      setActiveCustomStyleIds(previous)
      notify({ color: 'red', message: err instanceof Error ? err.message : '保存失败' })
    }
  }

  const openCreate = (kind: StyleKind) => {
    setDrawerKind(kind)
    setDrawerInitial({ name: '', css: '' })
    openDrawer()
  }

  const openEditTheme = (theme: Theme) => {
    setDrawerKind('theme')
    setDrawerInitial({ id: theme.id, name: theme.name, css: theme.css })
    openDrawer()
  }

  const openEditCustomStyle = (item: CustomStyle) => {
    setDrawerKind('custom-style')
    setDrawerInitial({ id: item.id, name: item.name, css: item.css })
    openDrawer()
  }

  const handleDeleteTheme = async (theme: Theme) => {
    if (!(await myModal.confirm({ message: `确定要删除主题「${theme.name}」吗？` }))) return
    const res = await fetch(`/api/themes/${theme.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchAll()
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  const handleDeleteCustomStyle = async (item: CustomStyle) => {
    if (!(await myModal.confirm({ message: `确定要删除自定义 CSS「${item.name}」吗？` }))) return
    const res = await fetch(`/api/custom-styles/${item.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchAll()
    } else {
      notify({ color: 'red', message: json.message || '删除失败' })
    }
  }

  const persistOrder = async (apiBase: string, ids: number[]) => {
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', ids }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '排序保存失败')
  }

  const handleThemeDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = themes.findIndex((t) => t.id === active.id)
    const newIndex = themes.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = themes
    const next = arrayMove(themes, oldIndex, newIndex).map((t, i) => ({ ...t, sortOrder: i + 1 }))
    setThemes(next)
    try {
      await persistOrder('/api/themes', next.map((t) => t.id))
    } catch (err) {
      setThemes(previous)
      notify({ color: 'red', message: err instanceof Error ? err.message : '排序保存失败' })
    }
  }

  const handleCustomStyleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = customStyles.findIndex((t) => t.id === active.id)
    const newIndex = customStyles.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = customStyles
    const next = arrayMove(customStyles, oldIndex, newIndex).map((t, i) => ({
      ...t,
      sortOrder: i + 1,
    }))
    setCustomStyles(next)
    try {
      await persistOrder('/api/custom-styles', next.map((t) => t.id))
    } catch (err) {
      setCustomStyles(previous)
      notify({ color: 'red', message: err instanceof Error ? err.message : '排序保存失败' })
    }
  }

  return (
    <Box mt="md">
      <PageHeader title="主题" />

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>主题</Title>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => openCreate('theme')}
            >
              新建主题
            </Button>
          </Group>
          <Text size="sm" c="dimmed" mb="sm">
            单选，用于提供前台基础样式
          </Text>

          {themes.length === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Text ta="center" c="dimmed">
                暂无主题
              </Text>
            </Paper>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleThemeDragEnd}
            >
              <SortableContext
                items={themes.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap="sm">
                  {themes.map((theme) => (
                    <SortableThemeRow
                      key={theme.id}
                      theme={theme}
                      selected={activeThemeId === theme.id}
                      onSelect={handleSelectTheme}
                      onEdit={openEditTheme}
                      onDelete={handleDeleteTheme}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>自定义 CSS</Title>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => openCreate('custom-style')}
            >
              新建自定义 CSS
            </Button>
          </Group>
          <Text size="sm" c="dimmed" mb="sm">
            多选，可同时叠加多个样式片段
          </Text>

          {customStyles.length === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Text ta="center" c="dimmed">
                暂无自定义 CSS
              </Text>
            </Paper>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCustomStyleDragEnd}
            >
              <SortableContext
                items={customStyles.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap="sm">
                  {customStyles.map((item) => (
                    <SortableCustomStyleRow
                      key={item.id}
                      item={item}
                      checked={activeCustomStyleIds.includes(item.id)}
                      onToggle={handleToggleCustomStyle}
                      onEdit={openEditCustomStyle}
                      onDelete={handleDeleteCustomStyle}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}
        </Grid.Col>
      </Grid>

      <StyleDrawer
        opened={drawerOpened}
        onClose={closeDrawer}
        kind={drawerKind}
        initial={drawerInitial}
        onSaved={fetchAll}
      />
    </Box>
  )
}
