'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { SafeDrawer } from '@/components/SafeDrawer'
import { notify } from '@/lib/notify'
import { Badge, Button, Checkbox, Group, ScrollArea, Stack, Text } from '@mantine/core'
import { IconGitCompare, IconRestore, IconTrash } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import RevisionDiffModal from './RevisionDiffModal'

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

/** 按更新时间排序返回 [较旧, 较新]；时间相同时用 id 兜底（小 id 视为更旧） */
function orderByTime(a: Revision, b: Revision): [Revision, Revision] {
  const ta = new Date(a.updatedAt).getTime()
  const tb = new Date(b.updatedAt).getTime()
  if (ta !== tb) return ta < tb ? [a, b] : [b, a]
  return a.id <= b.id ? [a, b] : [b, a]
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
  const [diffPair, setDiffPair] = useState<{ older: Revision; newer: Revision } | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)

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
    // 对比弹窗从属于历史抽屉：抽屉打开/关闭、或切换目标（apiBase 变化会重建
    // fetchRevisions）时，一律关闭并清空对比，避免 diff 全屏弹窗脱离抽屉独立残留
    setDiffOpen(false)
    setDiffPair(null)
  }, [opened, fetchRevisions])

  // 最近一次正式发布的版本（列表按 updatedAt 倒序，故第一条 published 即最新发布）
  const lastPublished = revisions.find((r) => r.status === 'published') ?? null
  const selectedRevisions = revisions.filter((r) => selected.has(r.id))
  // 唯一选中项恰好就是最近发布版时，与自身对比无意义，需排除
  const isSelfCompare =
    selected.size === 1 && lastPublished !== null && selectedRevisions[0]?.id === lastPublished.id
  // 对比按钮显示条件：选中两条，或选中一条且存在正式发布记录（且非自比较）
  const canCompare =
    selected.size === 2 || (selected.size === 1 && lastPublished !== null && !isSelfCompare)

  const handleCompare = () => {
    let pair: [Revision, Revision] | null = null
    if (selectedRevisions.length === 2) {
      pair = orderByTime(selectedRevisions[0], selectedRevisions[1])
    } else if (selectedRevisions.length === 1 && lastPublished) {
      pair = orderByTime(selectedRevisions[0], lastPublished)
    }
    if (!pair) return
    setDiffPair({ older: pair[0], newer: pair[1] })
    setDiffOpen(true)
  }

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
    <>
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
                <Group gap="xs">
                  {canCompare && (
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconGitCompare size={14} />}
                      onClick={handleCompare}
                    >
                      {t('compare')}
                    </Button>
                  )}
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
      <RevisionDiffModal
        opened={opened && diffOpen}
        onClose={() => setDiffOpen(false)}
        apiBase={apiBase}
        older={diffPair?.older ?? null}
        newer={diffPair?.newer ?? null}
      />
    </>
  )
}
