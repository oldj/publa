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
  Badge,
  Box,
  Button,
  Code,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import {
  IconEdit,
  IconGripVertical,
  IconPlus,
  IconRouteAltLeft,
  IconTrash,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '../../_components/AdminCountsContext'

// 只使用 translate，忽略 scale，避免不同高度的项拖拽时出现压缩效果
function translateOnly(transform: Transform | null) {
  if (!transform) return undefined
  return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
}

interface RedirectRule {
  id: number
  order: number
  pathRegex: string
  redirectTo: string
  redirectType: '301' | '302' | '307' | '308'
  memo: string | null
}

interface RedirectRuleFormState {
  pathRegex: string
  redirectTo: string
  redirectType: RedirectRule['redirectType']
  memo: string
}

const EMPTY_FORM: RedirectRuleFormState = {
  pathRegex: '',
  redirectTo: '',
  redirectType: '301',
  memo: '',
}

function SortableRuleRow({
  item,
  onEdit,
  onDelete,
}: {
  item: RedirectRule
  onEdit: (item: RedirectRule) => void
  onDelete: (item: RedirectRule) => void
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
        backgroundColor: '#fff',
      }}
      data-role="redirect-rule-row"
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group align="flex-start" wrap="nowrap" gap="sm" style={{ flex: 1 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            {...attributes}
            {...listeners}
            aria-label="拖拽排序"
            style={{ cursor: 'grab', marginTop: 2 }}
          >
            <IconGripVertical size={18} />
          </ActionIcon>

          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs">
              <Badge variant="light">#{item.order}</Badge>
              <Badge
                color={
                  item.redirectType === '301' || item.redirectType === '308' ? 'blue' : 'orange'
                }
                variant="light"
              >
                {item.redirectType}
              </Badge>
            </Group>

            <div>
              <Text size="sm" fw={600} mb={4}>
                匹配路径正则
              </Text>
              <Code block>{item.pathRegex}</Code>
            </div>

            <div>
              <Text size="sm" fw={600} mb={4}>
                跳转目标
              </Text>
              <Code block>{item.redirectTo}</Code>
            </div>

            <div>
              <Text size="sm" fw={600} mb={4}>
                备注
              </Text>
              <Text size="sm" c={item.memo ? undefined : 'dimmed'}>
                {item.memo || '无'}
              </Text>
            </div>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => onEdit(item)}
            aria-label="编辑规则"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDelete(item)}
            aria-label="删除规则"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  )
}

export default function RedirectRulesPage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [rules, setRules] = useState<RedirectRule[]>([])
  const [loading, setLoading] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [opened, setOpened] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null)
  const [form, setForm] = useState<RedirectRuleFormState>(EMPTY_FORM)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const fetchRules = useCallback(async () => {
    const response = await fetch('/api/redirect-rules')
    const json = await response.json()
    if (json.success) {
      setRules(json.data)
    }
  }, [])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace('/admin')
    }
  }, [currentUser, router])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchRules()
  }, [currentUser, fetchRules])

  const resetForm = () => {
    setEditingRuleId(null)
    setForm(EMPTY_FORM)
  }

  const handleCreate = () => {
    resetForm()
    setOpened(true)
  }

  const handleEdit = (item: RedirectRule) => {
    setEditingRuleId(item.id)
    setForm({
      pathRegex: item.pathRegex,
      redirectTo: item.redirectTo,
      redirectType: item.redirectType,
      memo: item.memo || '',
    })
    setOpened(true)
  }

  const handleSubmit = async () => {
    if (!form.pathRegex.trim() || !form.redirectTo.trim()) {
      notify({ color: 'red', message: '匹配正则和跳转目标不能为空' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        editingRuleId ? `/api/redirect-rules/${editingRuleId}` : '/api/redirect-rules',
        {
          method: editingRuleId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const json = await response.json()

      if (!json.success) {
        notify({ color: 'red', message: json.message || '保存失败' })
        return
      }

      notify({ color: 'green', message: editingRuleId ? '规则已更新' : '规则已创建' })
      setOpened(false)
      resetForm()
      await fetchRules()
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: RedirectRule) => {
    if (!(await myModal.confirm({ message: `确定要删除第 ${item.order} 条跳转规则吗？` }))) return

    try {
      const response = await fetch(`/api/redirect-rules/${item.id}`, {
        method: 'DELETE',
      })
      const json = await response.json()

      if (!json.success) {
        notify({ color: 'red', message: json.message || '删除失败' })
        return
      }

      notify({ color: 'green', message: '规则已删除' })
      await fetchRules()
    } catch {
      notify({ color: 'red', message: '网络错误' })
    }
  }

  const persistOrder = async (items: RedirectRule[]) => {
    const response = await fetch('/api/redirect-rules', {
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

    const oldIndex = rules.findIndex((item) => item.id === active.id)
    const newIndex = rules.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const nextItems = arrayMove(rules, oldIndex, newIndex).map((item, index) => ({
      ...item,
      order: index + 1,
    }))
    const previousItems = rules

    setRules(nextItems)
    setSavingOrder(true)
    try {
      await persistOrder(nextItems)
      notify({ color: 'green', message: '排序已更新' })
    } catch {
      setRules(previousItems)
      notify({ color: 'red', message: '排序保存失败' })
      await fetchRules()
    } finally {
      setSavingOrder(false)
    }
  }

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={3}>跳转规则</Title>
          <Text size="sm" c="dimmed" mt={4}>
            当前台路径最终会进入 404 时，将按以下顺序从上到下匹配第一条命中的规则。
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          新建规则
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" mb="lg">
        <Stack gap={6}>
          <Group gap="xs">
            <IconRouteAltLeft size={18} />
            <Text fw={600}>规则说明</Text>
          </Group>
          <Text size="sm" c="dimmed">
            仅匹配请求的 pathname，不包含 query 和 hash。建议在正则中显式使用 <Code>^</Code> 和{' '}
            <Code>$</Code>。
          </Text>
          <Text size="sm" c="dimmed">
            跳转目标支持站内路径或完整的 http/https URL，并支持使用 <Code>$1</Code> 到{' '}
            <Code>$9</Code> 引用捕获组。
          </Text>
          {savingOrder ? (
            <Text size="sm" c="blue">
              正在保存新的排序顺序...
            </Text>
          ) : null}
        </Stack>
      </Paper>

      {rules.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text ta="center" c="dimmed">
            暂无跳转规则
          </Text>
        </Paper>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={rules.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap="sm">
              {rules.map((item) => (
                <SortableRuleRow
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false)
          resetForm()
        }}
        title={editingRuleId ? '编辑跳转规则' : '新建跳转规则'}
        centered
      >
        <Stack>
          <TextInput
            label="匹配路径正则"
            placeholder="^/old/path/(\\d+)$"
            value={form.pathRegex}
            onChange={(event) => setForm((prev) => ({ ...prev, pathRegex: event.target.value }))}
            description="匹配对象是 pathname，例如 /old/path/123。"
          />
          <TextInput
            label="跳转目标"
            placeholder="/posts/$1 或 https://example.com/posts/$1"
            value={form.redirectTo}
            onChange={(event) => setForm((prev) => ({ ...prev, redirectTo: event.target.value }))}
          />
          <Select
            label="跳转类型"
            data={[
              { value: '301', label: '301 永久跳转' },
              { value: '302', label: '302 临时跳转' },
              { value: '307', label: '307 临时跳转' },
              { value: '308', label: '308 永久跳转' },
            ]}
            value={form.redirectType}
            onChange={(value) =>
              setForm((prev) => ({
                ...prev,
                redirectType: (value || '301') as RedirectRule['redirectType'],
              }))
            }
          />
          <Textarea
            label="备注"
            autosize
            minRows={3}
            value={form.memo}
            onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setOpened(false)
                resetForm()
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingRuleId ? '保存' : '创建'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
