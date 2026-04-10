'use client'

import { Button, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import '@mantine/dates/styles.css'
import dayjs from 'dayjs'
import myModal from './myModals'

export interface PublishSettingsProps {
  /** 当前持久化的状态 */
  currentStatus: string
  /** 当前激活的 tab */
  publishTab: string
  onPublishTabChange: (tab: string) => void
  /** 定时发布时间 */
  scheduledTime: Date | null
  onScheduledTimeChange: (time: Date | null) => void
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
  return (
    <Paper withBorder p="md" mih={200}>
      <Text fw={500} mb="sm">
        发布设置
      </Text>
      <SegmentedControl
        fullWidth
        value={publishTab}
        data={[
          { value: 'draft', label: '草稿' },
          { value: 'scheduled', label: '定时发布' },
          { value: 'published', label: '已发布' },
        ]}
        onChange={onPublishTabChange}
      />

      {/* 草稿 */}
      {publishTab === 'draft' && (
        <Stack mt="sm" gap="xs">
          {currentStatus === 'draft' ? (
            <Text size="sm" c="dimmed">
              当前为草稿状态
            </Text>
          ) : (
            <Button
              variant="light"
              color="orange"
              fullWidth
              onClick={async () => {
                if (
                  !(await myModal.confirm({
                    message: `确定要将当前${entityLabel}转为草稿状态吗？这个操作将撤销${entityLabel}发布，使其对外部不可见。`,
                  }))
                )
                  return
                onConvertToDraft()
              }}
              loading={loading}
            >
              转为草稿
            </Button>
          )}
        </Stack>
      )}

      {/* 定时发布 */}
      {publishTab === 'scheduled' && (
        <Stack mt="sm" gap="xs">
          {currentStatus === 'published' ? (
            <Text size="sm" c="dimmed">
              {entityLabel}已发布，无需定时发布。
            </Text>
          ) : (
            <>
              <DateTimePicker
                label="发布时间"
                placeholder="选择日期和时间"
                value={scheduledTime}
                valueFormat={'YYYY-MM-DD HH:mm'}
                onChange={(v) => onScheduledTimeChange(v as Date | null)}
                minDate={new Date()}
                popoverProps={{ shadow: 'md' }}
                highlightToday
                presets={[
                  { value: dayjs().format('YYYY-MM-DD'), label: '今天' },
                  {
                    value: dayjs().add(1, 'day').format('YYYY-MM-DD'),
                    label: '明天',
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
                  const timeStr = dayjs(scheduledTime).format('YYYY-MM-DD HH:mm:ss')
                  if (
                    !(await myModal.confirm({
                      message: `确定要将${entityLabel}设为定时发布吗？\n\n发布时间：${timeStr}`,
                    }))
                  )
                    return
                  onSetScheduled(scheduledTime.toISOString())
                }}
                loading={loading}
              >
                {currentStatus === 'scheduled' ? '更新定时发布' : '设为定时发布'}
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
              尚未发布
            </Text>
          )}
          {publishedAt && (
            <Text size="sm" c="dimmed">
              发布时间：{dayjs(publishedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          )}
          {currentStatus === 'published' && dirty && (
            <Text size="sm" c="orange">
              当前有未发布的修改，可点击顶部「发布」按钮再次发布。
            </Text>
          )}
        </Stack>
      )}
    </Paper>
  )
}
