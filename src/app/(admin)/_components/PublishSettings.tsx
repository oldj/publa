'use client'

import { Button, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import '@mantine/dates/styles.css'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import myModal from './myModals'

export interface PublishSettingsProps {
  /** 当前持久化的状态 */
  currentStatus: string
  /** 当前激活的 tab */
  publishTab: string
  onPublishTabChange: (tab: string) => void
  /** 定时发布时间 */
  scheduledTime: string | null
  onScheduledTimeChange: (time: string | null) => void
  /** 发布时间 */
  publishedAt: string | null
  /** 是否有未保存的修改 */
  dirty: boolean
  /** 加载状态 */
  loading: boolean
  /** 转为草稿回调 */
  onConvertToDraft: () => void
  /** 设置定时发布回调 */
  onSetScheduled: (publishedAt: string) => void
  /** 实体标签，用于确认对话框文案，如 '文章' 或 '页面' */
  entityLabel: string
}

export default function PublishSettings({
  currentStatus,
  publishTab,
  onPublishTabChange,
  scheduledTime,
  onScheduledTimeChange,
  publishedAt,
  dirty,
  loading,
  onConvertToDraft,
  onSetScheduled,
  entityLabel,
}: PublishSettingsProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('admin.editor.publishSettings')
  return (
    <Paper withBorder p="md" mih={200}>
      <Text fw={500} mb="sm">
        {t('title')}
      </Text>
      <SegmentedControl
        fullWidth
        value={publishTab}
        data={[
          { value: 'draft', label: tCommon('status.draft') },
          { value: 'scheduled', label: tCommon('status.scheduled') },
          { value: 'published', label: tCommon('status.published') },
        ]}
        onChange={onPublishTabChange}
      />

      {/* 草稿 */}
      {publishTab === 'draft' && (
        <Stack mt="sm" gap="xs">
          {currentStatus === 'draft' ? (
            <Text size="sm" c="dimmed">
              {t('currentDraft')}
            </Text>
          ) : (
            <Button
              variant="light"
              color="orange"
              fullWidth
              onClick={async () => {
                if (
                  !(await myModal.confirm({
                    message: t('convertToDraftConfirm', { entityLabel }),
                  }))
                )
                  return
                onConvertToDraft()
              }}
              loading={loading}
            >
              {t('convertToDraft')}
            </Button>
          )}
        </Stack>
      )}

      {/* 定时发布 */}
      {publishTab === 'scheduled' && (
        <Stack mt="sm" gap="xs">
          {currentStatus === 'published' ? (
            <Text size="sm" c="dimmed">
              {t('alreadyPublishedHint', { entityLabel })}
            </Text>
          ) : (
            <>
              <DateTimePicker
                label={t('publishAt')}
                placeholder={t('pickDateTime')}
                value={scheduledTime}
                valueFormat={'YYYY-MM-DD HH:mm'}
                onChange={(v) => onScheduledTimeChange(v as string | null)}
                popoverProps={{ shadow: 'md' }}
                highlightToday
                presets={[
                  { value: dayjs().format('YYYY-MM-DD') + ' 10:30', label: t('todayAt1030') },
                  { value: dayjs().format('YYYY-MM-DD') + ' 16:30', label: t('todayAt1630') },
                  { value: dayjs().format('YYYY-MM-DD') + ' 22:30', label: t('todayAt2230') },
                  {
                    value: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 10:30',
                    label: t('tomorrowAt1030'),
                  },
                  {
                    value: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 16:30',
                    label: t('tomorrowAt1630'),
                  },
                  {
                    value: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 22:30',
                    label: t('tomorrowAt2230'),
                  },
                ]}
                timePickerProps={{ withDropdown: true, popoverProps: { withinPortal: false } }}
                styles={{
                  day: {
                    '&[data-today][data-highlight-today]:not([data-selected], [data-in-range])': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                      border: 'none',
                    },
                  },
                }}
              />
              <Button
                fullWidth
                disabled={!scheduledTime}
                onClick={async () => {
                  if (!scheduledTime) return
                  const d = dayjs(scheduledTime)
                  const isPast = d.isBefore(dayjs())
                  const timeStr = d.format('YYYY-MM-DD HH:mm:ss')
                  const message = isPast
                    ? t('schedulePastConfirm', { entityLabel, time: timeStr })
                    : t('scheduleConfirm', { entityLabel, time: timeStr })
                  if (!(await myModal.confirm({ message }))) return
                  onSetScheduled(d.toISOString())
                }}
                loading={loading}
              >
                {currentStatus === 'scheduled' ? t('updateScheduled') : t('setScheduled')}
              </Button>
            </>
          )}
        </Stack>
      )}

      {/* 已发布 */}
      {publishTab === 'published' && (
        <Stack mt="sm" gap="xs">
          {currentStatus !== 'published' && !publishedAt && (
            <Text size="sm" c="dimmed">
              {t('notPublished')}
            </Text>
          )}
          {publishedAt && (
            <Text size="sm" c="dimmed">
              {t('publishedAt', { time: dayjs(publishedAt).format('YYYY-MM-DD HH:mm:ss') })}
            </Text>
          )}
          {currentStatus === 'published' && dirty && (
            <Text size="sm" c="orange">
              {t('dirtyPublishedHint')}
            </Text>
          )}
        </Stack>
      )}
    </Paper>
  )
}
