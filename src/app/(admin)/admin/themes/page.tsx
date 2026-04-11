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
import { IconExternalLink, IconGripVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  // saved* 对应 settings 中已生效的值；pending* 是用户当前在页面上的选择，保存前不生效
  const [savedThemeId, setSavedThemeId] = useState<number | null>(null)
  const [savedCustomStyleIds, setSavedCustomStyleIds] = useState<number[]>([])
  const [pendingThemeId, setPendingThemeId] = useState<number | null>(null)
  const [pendingCustomStyleIds, setPendingCustomStyleIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)
  const [drawerKind, setDrawerKind] = useState<StyleKind>('theme')
  const [drawerInitial, setDrawerInitial] = useState<StyleFormInitial | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const dirty = useMemo(() => {
    if (savedThemeId !== pendingThemeId) return true
    if (savedCustomStyleIds.length !== pendingCustomStyleIds.length) return true
    for (let i = 0; i < savedCustomStyleIds.length; i++) {
      if (savedCustomStyleIds[i] !== pendingCustomStyleIds[i]) return true
    }
    return false
  }, [savedThemeId, savedCustomStyleIds, pendingThemeId, pendingCustomStyleIds])

  /** 仅刷新主题与自定义 CSS 列表，不触碰 pending/saved 选中状态，供 Drawer / 删除回调使用 */
  const refreshLists = useCallback(async () => {
    const [themesRes, stylesRes] = await Promise.all([
      fetch('/api/themes').then((r) => r.json()),
      fetch('/api/custom-styles').then((r) => r.json()),
    ])
    if (themesRes.success) {
      const list = themesRes.data as Theme[]
      setThemes(list)
      // 若 pending 主题被删除：优先回退到 saved；saved 自身若也失效则回退到内置 light
      const validIds = new Set(list.map((t) => t.id))
      setPendingThemeId((prev) => {
        if (!prev || validIds.has(prev)) return prev
        if (savedThemeId && validIds.has(savedThemeId)) return savedThemeId
        return list.find((t) => t.builtinKey === 'light')?.id ?? null
      })
    }
    if (stylesRes.success) {
      const list = stylesRes.data as CustomStyle[]
      setCustomStyles(list)
      const validIds = new Set(list.map((t) => t.id))
      setPendingCustomStyleIds((prev) => prev.filter((id) => validIds.has(id)))
    }
  }, [savedThemeId])

  /** 初次加载：拉取列表 + settings，pending 与 saved 同步 */
  const fetchInitial = useCallback(async () => {
    const [themesRes, stylesRes, settingsRes] = await Promise.all([
      fetch('/api/themes').then((r) => r.json()),
      fetch('/api/custom-styles').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
    if (themesRes.success) setThemes(themesRes.data)
    if (stylesRes.success) setCustomStyles(stylesRes.data)
    if (settingsRes.success) {
      const s = settingsRes.data as Record<string, unknown>
      const themeId = typeof s.activeThemeId === 'number' && s.activeThemeId > 0 ? s.activeThemeId : null
      const styleIds = Array.isArray(s.activeCustomStyleIds)
        ? (s.activeCustomStyleIds as number[])
        : []
      setSavedThemeId(themeId)
      setSavedCustomStyleIds(styleIds)
      setPendingThemeId(themeId)
      setPendingCustomStyleIds(styleIds)
    }
  }, [])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchInitial()
  }, [currentUser, fetchInitial])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const handleSelectTheme = (id: number) => {
    setPendingThemeId(id)
  }

  const handleToggleCustomStyle = (id: number) => {
    setPendingCustomStyleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeThemeId: pendingThemeId ?? 0,
          activeCustomStyleIds: pendingCustomStyleIds,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSavedThemeId(pendingThemeId)
        setSavedCustomStyleIds(pendingCustomStyleIds)
        notify({ color: 'green', message: '已保存，前台生效' })
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    // 把预览选中项打包为一个 base64(JSON) 的 __debug 参数，前台的 PreviewStyles
    // 会解析这个参数并注入对应样式；同时全局监听会把 __debug 自动携带到后续链接上
    const payload = {
      theme: pendingThemeId,
      custom_styles: pendingCustomStyleIds,
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload))
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    const debug = btoa(binary)
    window.open(`/?__debug=${encodeURIComponent(debug)}`, '_blank')
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
      refreshLists()
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
      refreshLists()
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
      <PageHeader
        title="主题"
        dirty={dirty}
        dirtyMessage="选中项已变化，需保存后方可生效"
        loading={saving}
        onSave={handleSave}
        extra={
          <Button
            variant="default"
            leftSection={<IconExternalLink size={16} />}
            onClick={handlePreview}
          >
            预览
          </Button>
        }
      />

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
                      selected={pendingThemeId === theme.id}
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
                      checked={pendingCustomStyleIds.includes(item.id)}
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
        onSaved={refreshLists}
      />
    </Box>
  )
}
