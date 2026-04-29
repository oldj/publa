'use client'
import { notify } from '@/lib/notify'
import { LineChart } from '@mantine/charts'
import '@mantine/charts/styles.css'
import { Center, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { DatePickerInput, type DatePickerPreset } from '@mantine/dates'
import '@mantine/dates/styles.css'
import { IconCalendar } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import {
  DATE_FMT,
  daysAgoFrom,
  fillRange,
  matchPresetDays,
  parseSaved,
  PRESET_DAYS,
  rangeFromSaved,
  serializeSaved,
  type DailyView,
  type SavedRange,
} from './PostTrendModal.utils'

interface PostTrendModalProps {
  post: { id: number; title: string } | null
  onClose: () => void
}

const RANGE_STORAGE_KEY = 'admin.postTrend.range.v2'

function readSaved(): SavedRange | null {
  if (typeof window === 'undefined') return null
  try {
    return parseSaved(window.localStorage.getItem(RANGE_STORAGE_KEY))
  } catch {
    return null
  }
}

function writeSaved(saved: SavedRange) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, serializeSaved(saved))
  } catch {
    // 配额满或被禁用，忽略
  }
}

export default function PostTrendModal({ post, onClose }: PostTrendModalProps) {
  const t = useTranslations('admin.postTrend')

  const [range, setRange] = useState<[string | null, string | null]>(() => {
    const today = dayjs().format(DATE_FMT)
    return rangeFromSaved(readSaved(), today)
  })
  const [items, setItems] = useState<DailyView[]>([])
  const [loading, setLoading] = useState(false)

  const [from, to] = range
  const rangeReady = !!from && !!to

  useEffect(() => {
    if (!post || !rangeReady) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/posts/${post.id}/views?from=${from}&to=${to}`)
      .then(async (r) => {
        const json = await r.json()
        if (cancelled) return
        if (json.success) {
          setItems(json.data.items as DailyView[])
        } else {
          notify({ color: 'red', message: json.message || t('loadFailed') })
          setItems([])
        }
      })
      .catch(() => {
        if (cancelled) return
        notify({ color: 'red', message: t('loadFailed') })
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [post?.id, from, to, rangeReady, t])

  const filled = useMemo(() => {
    if (!from || !to) return []
    return fillRange(items, from, to)
  }, [items, from, to])

  const today = dayjs().format(DATE_FMT)
  const presets: DatePickerPreset<'range'>[] = PRESET_DAYS.map((days) => ({
    value: [daysAgoFrom(today, days), today],
    label: t(`preset.last${days}d` as const),
  }))

  const handleRangeChange = (next: [string | null, string | null]) => {
    setRange(next)
    const [nextFrom, nextTo] = next
    if (!nextFrom || !nextTo) return
    const matched = matchPresetDays(next, today)
    if (matched !== null) {
      writeSaved({ kind: 'preset', days: matched })
    } else {
      writeSaved({ kind: 'custom', from: nextFrom, to: nextTo })
    }
  }

  return (
    <Modal
      opened={!!post}
      onClose={onClose}
      size="xl"
      title={post ? t('title', { title: post.title }) : ''}
    >
      <Stack gap="md">
        <Group justify="flex-end">
          <DatePickerInput
            type="range"
            value={range}
            onChange={(v) => handleRangeChange(v as [string | null, string | null])}
            numberOfColumns={2}
            maxDate={today}
            presets={presets}
            valueFormat="YYYY-MM-DD"
            placeholder={t('rangeLabel')}
            leftSection={<IconCalendar size={16} />}
            allowSingleDateInRange
            clearable={false}
            w={280}
          />
        </Group>

        {loading ? (
          <Center h={280}>
            <Loader />
          </Center>
        ) : filled.length === 0 || filled.every((d) => d.viewCount === 0) ? (
          <Center h={280}>
            <Text c="dimmed" size="sm">
              {t('empty')}
            </Text>
          </Center>
        ) : (
          <LineChart
            h={280}
            data={filled}
            dataKey="date"
            series={[{ name: 'viewCount', label: t('seriesLabel'), color: 'blue.6' }]}
            curveType="monotone"
            withDots
            withTooltip
            tickLine="x"
          />
        )}
      </Stack>
    </Modal>
  )
}
