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
  type AnimateLayoutChanges,
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Transform } from '@dnd-kit/utilities'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChevronDown,
  IconChevronRight,
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'

// 只使用 translate，忽略 scale，避免不同高度的项拖拽时出现压缩效果
function translateOnly(transform: Transform | null) {
  if (!transform) return undefined
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
}

interface MenuItem {
  id: number
  title: string
  url: string
  parentId: number | null
  sortOrder: number
  target: string
  hidden: number
}

interface MenuTreeItem extends MenuItem {
  children: MenuItem[]
}

interface FormData {
  title: string
  url: string
  parentId: string
  target: string
  hidden: boolean
}

const emptyForm: FormData = { title: '', url: '', parentId: '', target: '_self', hidden: false }

// 拖拽结束后跳过归位动画，避免与状态更新冲突导致闪烁
const noDropAnimation: AnimateLayoutChanges = (args) => {
  if (args.wasDragging) return false
  return defaultAnimateLayoutChanges(args)
}

/** 子菜单项（可拖拽） */
function SortableChildItem({
  item,
  onEdit,
  onDelete,
  onToggleHidden,
}: {
  item: MenuItem
  onEdit: (item: MenuItem) => void
  onDelete: (id: number, title: string) => void
  onToggleHidden: (item: MenuItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    animateLayoutChanges: noDropAnimation,
  })

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="xs"
      radius="md"
      shadow={isDragging ? 'md' : undefined}
      style={{
        transform: translateOnly(transform),
        transition,
        opacity: isDragging ? 0.7 : item.hidden ? 0.5 : 1,
        backgroundColor: '#fff',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap" gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            {...attributes}
            {...listeners}
            aria-label="拖拽排序"
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={14} />
          </ActionIcon>

          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={500}>
              {item.title}
            </Text>
            {item.url && (
              <Text size="xs" c="dimmed" truncate>
                {item.url}
              </Text>
            )}
            {item.target === '_blank' && (
              <Badge size="xs" variant="light">
                新窗口
              </Badge>
            )}
            {item.hidden === 1 && (
              <Badge size="xs" variant="light" color="gray">
                已隐藏
              </Badge>
            )}
          </Group>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label={item.hidden ? '显示' : '隐藏'} withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => onToggleHidden(item)}
              aria-label={item.hidden ? '显示菜单' : '隐藏菜单'}
            >
              {item.hidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="编辑" withArrow>
            <ActionIcon variant="subtle" size="sm" onClick={() => onEdit(item)}>
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="删除" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => onDelete(item.id, item.title)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}

/** 父菜单项（可拖拽），内含可折叠的子菜单区域 */
function SortableParentItem({
  item,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  onChildDragEnd,
  onToggleHidden,
  sensors,
}: {
  item: MenuTreeItem
  expanded: boolean
  onToggleExpand: (id: number) => void
  onEdit: (item: MenuItem) => void
  onDelete: (id: number, title: string, childCount: number) => void
  onAddChild: (parentId: number) => void
  onChildDragEnd: (parentId: number, event: DragEndEvent) => void
  onToggleHidden: (item: MenuItem) => void
  sensors: ReturnType<typeof useSensors>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    animateLayoutChanges: noDropAnimation,
  })

  const hasChildren = item.children.length > 0

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      p="sm"
      radius="md"
      shadow={isDragging ? 'md' : undefined}
      style={{
        transform: translateOnly(transform),
        transition,
        opacity: isDragging ? 0.7 : item.hidden ? 0.5 : 1,
        backgroundColor: '#fff',
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap" gap="sm" style={{ flex: 1, minWidth: 0 }}>
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

          {/* 展开/收起按钮 */}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onToggleExpand(item.id)}
            aria-label={expanded ? '收起子菜单' : '展开子菜单'}
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </ActionIcon>

          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={500}>{item.title}</Text>
            {item.url && (
              <Text size="sm" c="dimmed" truncate>
                {item.url}
              </Text>
            )}
            {item.target === '_blank' && (
              <Badge size="xs" variant="light">
                新窗口
              </Badge>
            )}
            {item.hidden === 1 && (
              <Badge size="xs" variant="light" color="gray">
                已隐藏
              </Badge>
            )}
            {hasChildren && (
              <Badge size="xs" variant="light" color="blue">
                {item.children.length} 个子菜单
              </Badge>
            )}
          </Group>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label={item.hidden ? '显示' : '隐藏'} withArrow>
            <ActionIcon
              variant="subtle"
              onClick={() => onToggleHidden(item)}
              aria-label={item.hidden ? '显示菜单' : '隐藏菜单'}
            >
              {item.hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="添加子菜单" withArrow>
            <ActionIcon
              variant="subtle"
              onClick={() => onAddChild(item.id)}
              aria-label="添加子菜单"
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="编辑" withArrow>
            <ActionIcon variant="subtle" onClick={() => onEdit(item)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="删除" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onDelete(item.id, item.title, item.children.length)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 子菜单折叠区域 */}
      <Collapse expanded={expanded}>
        <Box pl={40} pt="sm">
          {hasChildren ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onChildDragEnd(item.id, event)}
            >
              <SortableContext
                items={item.children.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap="xs">
                  {item.children.map((child) => (
                    <SortableChildItem
                      key={child.id}
                      item={child}
                      onEdit={onEdit}
                      onDelete={(id, title) => onDelete(id, title, 0)}
                      onToggleHidden={onToggleHidden}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          ) : (
            <Text size="sm" c="dimmed">
              暂无子菜单
            </Text>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

export default function MenusPage() {
  const [menuList, setMenuList] = useState<MenuItem[]>([])
  const [opened, { open, close }] = useDisclosure(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // 从扁平列表派生树形结构
  const menuTree = useMemo<MenuTreeItem[]>(() => {
    const topLevel = menuList.filter((m) => !m.parentId).sort((a, b) => a.sortOrder - b.sortOrder)
    return topLevel.map((parent) => ({
      ...parent,
      children: menuList
        .filter((m) => m.parentId === parent.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  }, [menuList])

  const fetchMenus = useCallback(async () => {
    const res = await fetch('/api/menus')
    const json = await res.json()
    if (json.success) setMenuList(json.data)
  }, [])

  useEffect(() => {
    fetchMenus()
  }, [fetchMenus])

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleOpen = (menu?: MenuItem) => {
    if (menu) {
      setEditingId(menu.id)
      setForm({
        title: menu.title,
        url: menu.url,
        parentId: menu.parentId ? String(menu.parentId) : '',
        target: menu.target,
        hidden: menu.hidden === 1,
      })
    } else {
      setEditingId(null)
      setForm(emptyForm)
    }
    open()
  }

  // 添加子菜单：预填 parentId
  const handleAddChild = (parentId: number) => {
    setEditingId(null)
    setForm({ ...emptyForm, parentId: String(parentId) })
    // 确保父菜单展开
    setExpandedIds((prev) => new Set(prev).add(parentId))
    open()
  }

  const handleSubmit = async () => {
    if (!form.title) {
      notify({ color: 'red', message: '标题不能为空' })
      return
    }

    setLoading(true)
    try {
      const body: Record<string, any> = {
        title: form.title,
        url: form.url || '',
        parentId: form.parentId ? parseInt(form.parentId) : null,
        target: form.target,
        hidden: form.hidden ? 1 : 0,
      }

      // 新建时自动排到对应层级末尾
      if (!editingId) {
        const siblings = body.parentId
          ? menuList.filter((m) => m.parentId === body.parentId)
          : menuList.filter((m) => !m.parentId)
        const maxOrder = siblings.reduce((max, m) => Math.max(max, m.sortOrder), -1)
        body.sortOrder = maxOrder + 1
      }

      const url = editingId ? `/api/menus/${editingId}` : '/api/menus'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: editingId ? '更新成功' : '创建成功' })
        close()
        fetchMenus()
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, title: string, childCount: number) => {
    const message =
      childCount > 0
        ? `确定要删除菜单「${title}」吗？其下 ${childCount} 个子菜单也将被删除。`
        : `确定要删除菜单「${title}」吗？`
    if (!(await myModal.confirm({ message }))) return
    const res = await fetch(`/api/menus/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '删除成功' })
      fetchMenus()
    }
  }

  const handleReset = async () => {
    if (!(await myModal.confirm({ message: '确定要恢复默认菜单吗？现有菜单将被覆盖。' }))) return
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: '已恢复默认菜单' })
      fetchMenus()
    }
  }

  const handleToggleHidden = async (item: MenuItem) => {
    const newHidden = item.hidden ? 0 : 1
    // 先乐观更新 UI
    setMenuList((prev) => prev.map((m) => (m.id === item.id ? { ...m, hidden: newHidden } : m)))
    const res = await fetch(`/api/menus/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden: newHidden }),
    })
    const json = await res.json()
    if (json.success) {
      notify({ color: 'green', message: newHidden ? '菜单已隐藏' : '菜单已显示' })
    } else {
      // 回滚
      setMenuList((prev) => prev.map((m) => (m.id === item.id ? { ...m, hidden: item.hidden } : m)))
      notify({ color: 'red', message: '操作失败' })
    }
  }

  const persistOrder = async (items: MenuItem[]) => {
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        items: items.map((item, index) => ({ id: item.id, sortOrder: index })),
      }),
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error('Reorder failed')
    }
  }

  // 顶级菜单拖拽排序
  const handleParentDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = menuTree.findIndex((item) => item.id === active.id)
    const newIndex = menuTree.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reorderedParents = arrayMove(menuTree, oldIndex, newIndex)
    const previousList = menuList

    // 更新扁平列表中父菜单的 sortOrder
    const updatedList = menuList.map((item) => {
      if (!item.parentId) {
        const idx = reorderedParents.findIndex((p) => p.id === item.id)
        return idx >= 0 ? { ...item, sortOrder: idx } : item
      }
      return item
    })

    flushSync(() => {
      setMenuList(updatedList)
    })

    try {
      const parentItems = reorderedParents.map((p, i) => ({ ...p, sortOrder: i }))
      await persistOrder(parentItems)
      notify({ color: 'green', message: '排序已更新' })
    } catch {
      setMenuList(previousList)
      notify({ color: 'red', message: '排序保存失败' })
      await fetchMenus()
    }
  }

  // 子菜单拖拽排序
  const handleChildDragEnd = async (parentId: number, event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const parent = menuTree.find((p) => p.id === parentId)
    if (!parent) return

    const oldIndex = parent.children.findIndex((c) => c.id === active.id)
    const newIndex = parent.children.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reorderedChildren = arrayMove(parent.children, oldIndex, newIndex)
    const previousList = menuList

    // 更新扁平列表中子菜单的 sortOrder
    const childIdToOrder = new Map(reorderedChildren.map((c, i) => [c.id, i]))
    const updatedList = menuList.map((item) => {
      if (childIdToOrder.has(item.id)) {
        return { ...item, sortOrder: childIdToOrder.get(item.id)! }
      }
      return item
    })

    flushSync(() => {
      setMenuList(updatedList)
    })

    try {
      const childItems = reorderedChildren.map((c, i) => ({ ...c, sortOrder: i }))
      await persistOrder(childItems)
      notify({ color: 'green', message: '排序已更新' })
    } catch {
      setMenuList(previousList)
      notify({ color: 'red', message: '排序保存失败' })
      await fetchMenus()
    }
  }

  const topMenus = menuList.filter((m) => !m.parentId)

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>菜单管理</Title>
        <Group>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={handleReset}>
            恢复默认
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpen()}>
            新建菜单
          </Button>
        </Group>
      </Group>

      {menuTree.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text ta="center" c="dimmed">
            暂无菜单
          </Text>
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleParentDragEnd}
        >
          <SortableContext
            items={menuTree.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="sm">
              {menuTree.map((item) => (
                <SortableParentItem
                  key={item.id}
                  item={item}
                  expanded={expandedIds.has(item.id)}
                  onToggleExpand={toggleExpand}
                  onEdit={handleOpen}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onChildDragEnd={handleChildDragEnd}
                  onToggleHidden={handleToggleHidden}
                  sensors={sensors}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Modal opened={opened} onClose={close} title={editingId ? '编辑菜单' : '新建菜单'}>
        <TextInput
          label="标题"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <TextInput
          label="URL"
          mt="sm"
          placeholder="父菜单可留空，留空时点击仅展开子菜单"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
        <Select
          label="父菜单"
          placeholder="无（顶级菜单）"
          clearable
          mt="sm"
          data={topMenus
            .filter((m) => m.id !== editingId)
            .map((m) => ({ value: String(m.id), label: m.title }))}
          value={form.parentId}
          onChange={(v) => setForm({ ...form, parentId: v || '' })}
        />
        <Select
          label="打开方式"
          mt="sm"
          data={[
            { value: '_self', label: '当前窗口' },
            { value: '_blank', label: '新窗口' },
          ]}
          value={form.target}
          onChange={(v) => setForm({ ...form, target: v || '_self' })}
        />
        <Switch
          label="隐藏"
          description="隐藏后此菜单及其子菜单不会在前台显示"
          mt="sm"
          checked={form.hidden}
          onChange={(e) => setForm({ ...form, hidden: e.currentTarget.checked })}
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
