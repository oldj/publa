'use client'

import { Badge, Button, Group, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconDeviceFloppy, IconEye, IconSend, IconX } from '@tabler/icons-react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import myModal from './myModals'

interface EditorHeaderProps {
  entityId?: number
  entityKey: 'post' | 'page'
  entityLabel: string // "文章" | "页面"
  backUrl: string // 如 "/{adminPath}/posts" | "/{adminPath}/pages"
  status: string // 'draft' | 'scheduled' | 'published'
  dirty: boolean
  loading: boolean
  autoSaveTime: string | null
  onPreview: () => void
  onSaveDraft: () => void
  onPublish: () => Promise<void>
  onDiscardDraft: () => Promise<void>
}

/** 文章/页面编辑器公共顶栏，含操作按钮和标题/状态 */
export function EditorHeader({
  entityId,
  entityKey,
  entityLabel,
  backUrl,
  status,
  dirty,
  loading,
  autoSaveTime,
  onPreview,
  onSaveDraft,
  onPublish,
  onDiscardDraft,
}: EditorHeaderProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('admin.editor.header')
  return (
    <>
      {/* 固定在右上角的保存/发布按钮 */}
      <Group
        gap="xs"
        style={{
          position: 'sticky',
          top: 'var(--mantine-spacing-sm)',
          transform: 'translateY(-10px)',
          float: 'right',
          zIndex: 100,
          padding: 'var(--mantine-spacing-xs)',
          borderRadius: 'var(--mantine-radius-md)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {entityId && (
          <Button
            variant="subtle"
            leftSection={<IconEye size={16} />}
            onClick={onPreview}
            loading={loading}
          >
            {t('preview')}
          </Button>
        )}
        <Button
          variant="default"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={onSaveDraft}
          loading={loading}
        >
          {tCommon('actions.save')}
        </Button>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={async () => {
            if (status !== 'published') {
              if (!(await myModal.confirm({ message: t('publishConfirm', { entityLabel }) })))
                return
            }
            await onPublish()
          }}
          loading={loading}
        >
          {t('publish')}
        </Button>
      </Group>

      <Group mb="lg">
        <Button
          variant="subtle"
          component={Link}
          href={backUrl}
          leftSection={<IconArrowLeft size={16} />}
          data-role={`${entityKey}-editor-back-button`}
        >
          {t('back')}
        </Button>
        <Title order={3} data-role={`${entityKey}-editor-page-title`}>
          {entityId ? t('edit') : t('new')}
          {entityLabel}
        </Title>
        {entityId && (
          <Badge
            color={status === 'published' ? 'green' : status === 'scheduled' ? 'blue' : 'gray'}
            variant="light"
            size="lg"
          >
            {status === 'published'
              ? tCommon('status.published')
              : status === 'scheduled'
                ? tCommon('status.scheduled')
                : tCommon('status.draft')}
          </Badge>
        )}
        {dirty && (
          <Group gap={4}>
            <Badge color="orange" variant="light" size="lg">
              {t('modified')}
            </Badge>
            {entityId && status === 'published' && (
              <IconX
                size={16}
                color="var(--mantine-color-orange-6)"
                style={{ cursor: 'pointer' }}
                onClick={async () => {
                  if (!(await myModal.confirm({ message: t('discardDraftConfirm') }))) return
                  await onDiscardDraft()
                }}
              />
            )}
          </Group>
        )}
        {autoSaveTime && (
          <Text size="sm" c="dimmed" data-role="editor-autosave-time">
            {t('autosaveAt', { time: dayjs(autoSaveTime).format('YYYY-MM-DD HH:mm:ss') })}
          </Text>
        )}
      </Group>
    </>
  )
}
