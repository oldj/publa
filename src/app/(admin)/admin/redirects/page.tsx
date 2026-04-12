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
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('admin.redirectsPage')
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
            aria-label={t('aria.drag')}
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
                {t('labels.pathRegex')}
              </Text>
              <Code block>{item.pathRegex}</Code>
            </div>

            <div>
              <Text size="sm" fw={600} mb={4}>
                {t('labels.redirectTo')}
              </Text>
              <Code block>{item.redirectTo}</Code>
            </div>

            <div>
              <Text size="sm" fw={600} mb={4}>
                {t('labels.memo')}
              </Text>
              <Text size="sm" c={item.memo ? undefined : 'dimmed'}>
                {item.memo || t('labels.none')}
              </Text>
            </div>
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => onEdit(item)}
            aria-label={t('aria.edit')}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDelete(item)}
            aria-label={t('aria.delete')}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  )
}

export default function RedirectRulesPage() {
  const t = useTranslations('admin.redirectsPage')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const adminUrl = useAdminUrl()
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
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

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
      notify({ color: 'red', message: t('validation.pathRegexAndRedirectToRequired') })
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
        notify({ color: 'red', message: json.message || tCommon('errors.saveFailed') })
        return
      }

      notify({
        color: 'green',
        message: editingRuleId ? t('messages.updated') : t('messages.created'),
      })
      setOpened(false)
      resetForm()
      await fetchRules()
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: RedirectRule) => {
    if (!(await myModal.confirm({ message: t('confirm.delete', { order: item.order }) }))) return

    try {
      const response = await fetch(`/api/redirect-rules/${item.id}`, {
        method: 'DELETE',
      })
      const json = await response.json()

      if (!json.success) {
        notify({ color: 'red', message: json.message || tCommon('errors.deleteFailed') })
        return
      }

      notify({ color: 'green', message: t('messages.deleted') })
      await fetchRules()
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
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
      notify({ color: 'green', message: t('messages.orderUpdated') })
    } catch {
      setRules(previousItems)
      notify({ color: 'red', message: t('messages.orderSaveFailed') })
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
          <Title order={3}>{t('title')}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {t('description')}
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
          {t('newRule')}
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" mb="lg">
        <Stack gap={6}>
          <Group gap="xs">
            <IconRouteAltLeft size={18} />
            <Text fw={600}>{t('ruleGuideTitle')}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            {t('ruleGuidePathRegex')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('ruleGuideRedirectTo')}
          </Text>
          {savingOrder ? (
            <Text size="sm" c="blue">
              {t('savingOrder')}
            </Text>
          ) : null}
        </Stack>
      </Paper>

      {rules.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text ta="center" c="dimmed">
            {t('empty')}
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
        title={editingRuleId ? t('modal.editTitle') : t('modal.createTitle')}
        centered
      >
        <Stack>
          <TextInput
            label={t('fields.pathRegex')}
            placeholder="^/old/path/(\\d+)$"
            value={form.pathRegex}
            onChange={(event) => setForm((prev) => ({ ...prev, pathRegex: event.target.value }))}
            description={t('fields.pathRegexDescription')}
          />
          <TextInput
            label={t('fields.redirectTo')}
            placeholder={t('fields.redirectToPlaceholder')}
            value={form.redirectTo}
            onChange={(event) => setForm((prev) => ({ ...prev, redirectTo: event.target.value }))}
          />
          <Select
            label={t('fields.redirectType')}
            data={[
              { value: '301', label: t('redirectTypeOptions.301') },
              { value: '302', label: t('redirectTypeOptions.302') },
              { value: '307', label: t('redirectTypeOptions.307') },
              { value: '308', label: t('redirectTypeOptions.308') },
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
            label={t('fields.memo')}
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
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingRuleId ? tCommon('actions.save') : tCommon('actions.create')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
