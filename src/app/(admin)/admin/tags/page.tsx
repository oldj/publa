'use client'
import myModal from '@/app/(admin)/_components/myModals'
import { PostList } from '@/app/(admin)/_components/PostList'
import { SafeDrawer } from '@/components/SafeDrawer'
import adminStyles from '../../_components/AdminShell.module.scss'
import { NowrapBadge } from '../../_components/NowrapBadge'

import { notify } from '@/lib/notify'
import {
  ActionIcon,
  Box,
  Button,
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
import { useLocale, useTranslations } from 'next-intl'
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
  const locale = useLocale()
  const t = useTranslations('admin.tagsPage')
  const tCommon = useTranslations('common')
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
        cmp = a[sortBy].localeCompare(b[sortBy], locale)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [locale, tagList, sortBy, sortDir])

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
      notify({ color: 'red', message: t('validation.nameAndSlugRequired') })
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
        notify({
          color: 'green',
          message: editingId
            ? tCommon('messages.updateSuccess')
            : tCommon('messages.createSuccess'),
        })
        close()
        fetchTags()
      } else {
        notify({ color: 'red', message: data.message || tCommon('errors.operationFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!(await myModal.confirm({ message: t('deleteConfirm', { name }) }))) return

    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (data.success) {
      notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
      fetchTags()
    } else {
      notify({ color: 'red', message: data.message || tCommon('errors.deleteFailed') })
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
        notify({ color: 'green', message: t('messages.recountSuccess') })
        fetchTags()
      } else {
        notify({ color: 'red', message: data.message || t('messages.recountFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setRecounting(false)
    }
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

      <Table.ScrollContainer minWidth={500} className={adminStyles.tableContainer}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {(
                [
                  ['name', t('columns.name')],
                  ['slug', t('columns.slug')],
                  ['postCount', t('columns.postCount')],
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
              <Table.Th>{t('columns.actions')}</Table.Th>
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
                    <ActionIcon
                      variant="subtle"
                      onClick={() => handleOpen(tag)}
                      aria-label={t('aria.edit')}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(tag.id, tag.name)}
                      aria-label={t('aria.delete')}
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
                    {t('empty')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

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
        title={drawerTag ? t('drawerTitle', { name: drawerTag.name }) : t('drawerFallbackTitle')}
      >
        {drawerTag && <PostList key={drawerTag.id} initialTagId={String(drawerTag.id)} />}
      </SafeDrawer>
    </Box>
  )
}
