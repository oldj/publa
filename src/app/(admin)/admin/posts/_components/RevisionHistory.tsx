'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { SafeDrawer } from '@/components/SafeDrawer'
import { Badge, Button, Checkbox, Group, ScrollArea, Stack, Text } from '@mantine/core'
import { notify } from '@/lib/notify'
import { IconRestore, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

interface Revision {
  id: number
  title: string
  status: string
  contentRawSize: number
  updatedAt: string
  createdBy: number
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

interface RevisionDetail {
  id: number
  contentRaw: string
  contentHtml: string
  contentText: string
}

interface Props {
  targetType: 'post' | 'page'
  targetId: number
  opened: boolean
  onClose: () => void
  onRestore: () => void
}

export default function RevisionHistory({
  targetType,
  targetId,
  opened,
  onClose,
  onRestore,
}: Props) {
  const t = useTranslations('admin.revisionHistory')
  const tCommon = useTranslations('common')
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [preview, setPreview] = useState<RevisionDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const apiBase = `/api/${targetType === 'post' ? 'posts' : 'pages'}/${targetId}/revisions`

  const fetchRevisions = useCallback(async () => {
    const res = await fetch(apiBase)
    const json = await res.json()
    if (json.success) {
      setRevisions(json.data)
    }
  }, [apiBase])

  useEffect(() => {
    if (opened) {
      fetchRevisions()
      setSelected(new Set())
      setPreview(null)
    }
  }, [opened, fetchRevisions])

  const handlePreview = async (id: number) => {
    const res = await fetch(`${apiBase}/${id}`)
    const json = await res.json()
    if (json.success) {
      setPreview(json.data)
    }
  }

  const handleRestore = async (id: number) => {
    if (!(await myModal.confirm({ message: t('restoreConfirm') }))) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/${id}/restore`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: t('restoreSuccess') })
        onRestore()
        onClose()
      } else {
        notify({ color: 'red', message: json.message || t('restoreFailed') })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!(await myModal.confirm({ message: t('deleteSelectedConfirm', { count: selected.size }) })))
      return
    setLoading(true)
    try {
      const res = await fetch(apiBase, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: tCommon('messages.deleteSuccess') })
        setSelected(new Set())
        setPreview(null)
        fetchRevisions()
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <SafeDrawer opened={opened} onClose={onClose} title={t('title')} position="right" size="xl">
      <Stack h="calc(100vh - 100px)">
        {revisions.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('empty')}
          </Text>
        ) : (
          <>
            {/* 操作栏 */}
            <Group justify="space-between">
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  {t('count', { count: revisions.length })}
                </Text>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setSelected(new Set(revisions.map((r) => r.id)))}
                >
                  {t('selectAll')}
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setSelected((prev) => {
                      const next = new Set<number>()
                      for (const r of revisions) {
                        if (!prev.has(r.id)) next.add(r.id)
                      }
                      return next
                    })
                  }}
                >
                  {t('invertSelection')}
                </Button>
              </Group>
              {selected.size > 0 && (
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleDelete}
                  loading={loading}
                >
                  {t('deleteSelected', { count: selected.size })}
                </Button>
              )}
            </Group>

            {/* 版本列表 */}
            <ScrollArea
              style={{ flex: preview ? '0 0 auto' : '1' }}
              mah={preview ? 200 : undefined}
            >
              <Stack gap="xs">
                {revisions.map((rev) => (
                  <Group
                    key={rev.id}
                    p="xs"
                    style={{
                      borderRadius: 6,
                      border: '1px solid var(--mantine-color-gray-3)',
                      cursor: 'pointer',
                      background:
                        preview?.id === rev.id ? 'var(--mantine-color-blue-0)' : undefined,
                    }}
                    onClick={() => handlePreview(rev.id)}
                    justify="space-between"
                  >
                    <Group gap="sm">
                      <Checkbox
                        checked={selected.has(rev.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelect(rev.id)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        size="xs"
                      />
                      <div>
                        <Group gap={4}>
                          {rev.title && (
                            <Text size="sm" fw={500}>
                              {rev.title}
                            </Text>
                          )}
                          <Badge
                            size="xs"
                            variant="light"
                            color={rev.status === 'published' ? 'green' : 'blue'}
                          >
                            {rev.status === 'published' ? t('published') : t('draftSnapshot')}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {dayjs(rev.updatedAt).format('YYYY-MM-DD HH:mm:ss')} ·{' '}
                          {formatSize(rev.contentRawSize)}
                        </Text>
                      </div>
                    </Group>
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<IconRestore size={14} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestore(rev.id)
                      }}
                      loading={loading}
                    >
                      {t('restore')}
                    </Button>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>

            {/* 内容预览 */}
            {preview && (
              <ScrollArea
                style={{
                  flex: 1,
                  border: '1px solid var(--mantine-color-gray-3)',
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <div
                  className="rich-content"
                  dangerouslySetInnerHTML={{ __html: preview.contentHtml }}
                />
              </ScrollArea>
            )}
          </>
        )}
      </Stack>
    </SafeDrawer>
  )
}
