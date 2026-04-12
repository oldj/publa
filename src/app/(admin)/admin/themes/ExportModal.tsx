'use client'

import { notify } from '@/lib/notify'
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core'
import { useTranslations } from 'next-intl'
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

const LABELS: Record<ExportKind, { title: string; api: string; fallback: string; empty: string }> =
  {
    theme: {
      title: 'themeTitle',
      api: '/api/themes/export',
      fallback: 'themeFallback',
      empty: 'themeEmpty',
    },
    'custom-style': {
      title: 'customStyleTitle',
      api: '/api/custom-styles/export',
      fallback: 'customStyleFallback',
      empty: 'customStyleEmpty',
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
  const t = useTranslations('admin.themesPage.exportModal')
  const tCommon = useTranslations('common')
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
        let message = tCommon('errors.exportFailed')
        try {
          const json = await res.json()
          if (json?.message) message = json.message
        } catch {
          // ignore
        }
        notify({ color: 'red', message })
        return
      }
      const filename = parseFilename(res.headers.get('Content-Disposition')) || t(labels.fallback)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      notify({ color: 'green', message: t('exported') })
      onClose()
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t(labels.title)} size="md">
      {items.length === 0 ? (
        <Stack>
          <Text c="dimmed" ta="center" py="md">
            {t(labels.empty)}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {tCommon('actions.close')}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('description')}
            </Text>
            <Button size="xs" variant="subtle" onClick={toggleAll}>
              {allSelected ? t('unselectAll') : t('selectAll')}
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
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleExport} disabled={selected.length === 0} loading={submitting}>
              {selected.length > 0
                ? t('exportWithCount', { count: selected.length })
                : tCommon('actions.export')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
