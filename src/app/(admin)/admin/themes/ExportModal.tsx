'use client'

import { notify } from '@/lib/notify'
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'

export type ExportKind = 'theme' | 'custom-style'

interface ExportItem {
  id: number
  name: string
}

interface ExportModalProps {
  opened: boolean
  onClose: () => void
  kind: ExportKind
  items: ExportItem[]
}

const LABELS: Record<ExportKind, { title: string; api: string; fallback: string; empty: string }> = {
  theme: {
    title: '导出主题',
    api: '/api/themes/export',
    fallback: 'themes.zip',
    empty: '暂无可导出的自定义主题',
  },
  'custom-style': {
    title: '导出自定义 CSS',
    api: '/api/custom-styles/export',
    fallback: 'custom-styles.zip',
    empty: '暂无可导出的自定义 CSS',
  },
}

/** 从 Content-Disposition 读出 filename* 或 filename，用于 <a download> */
function parseFilename(header: string | null): string | null {
  if (!header) return null
  const starMatch = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1])
    } catch {
      // ignore
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i)
  if (plain) {
    try {
      return decodeURIComponent(plain[1])
    } catch {
      return plain[1]
    }
  }
  return null
}

export function ExportModal({ opened, onClose, kind, items }: ExportModalProps) {
  const labels = LABELS[kind]
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 每次打开时重置选中项
  useEffect(() => {
    if (opened) setSelected([])
  }, [opened])

  const allIds = useMemo(() => items.map((item) => String(item.id)), [items])
  const allSelected = selected.length > 0 && selected.length === allIds.length

  const toggleAll = () => {
    setSelected(allSelected ? [] : allIds)
  }

  const handleExport = async () => {
    if (selected.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(labels.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected.map((v) => Number(v)) }),
      })
      if (!res.ok) {
        let message = '导出失败'
        try {
          const json = await res.json()
          if (json?.message) message = json.message
        } catch {
          // ignore
        }
        notify({ color: 'red', message })
        return
      }
      const filename = parseFilename(res.headers.get('Content-Disposition')) || labels.fallback
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify({ color: 'green', message: '已导出' })
      onClose()
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={labels.title} size="md">
      {items.length === 0 ? (
        <Stack>
          <Text c="dimmed" ta="center" py="md">
            {labels.empty}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              关闭
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              勾选要导出的项，生成 .zip 文件
            </Text>
            <Button size="xs" variant="subtle" onClick={toggleAll}>
              {allSelected ? '取消全选' : '全选'}
            </Button>
          </Group>
          <Checkbox.Group value={selected} onChange={setSelected}>
            <Stack gap="xs">
              {items.map((item) => (
                <Checkbox key={item.id} value={String(item.id)} label={item.name} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              onClick={handleExport}
              disabled={selected.length === 0}
              loading={submitting}
            >
              导出{selected.length > 0 ? ` (${selected.length})` : ''}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
