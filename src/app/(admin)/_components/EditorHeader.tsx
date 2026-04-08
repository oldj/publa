'use client'

import { Badge, Button, Group, Text, Title } from '@mantine/core'
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEye,
  IconSend,
  IconX,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import Link from 'next/link'
import myModal from './myModals'

interface EditorHeaderProps {
  entityId?: number
  entityLabel: string // "文章" | "页面"
  backUrl: string // "/admin/posts" | "/admin/pages"
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
            预览
          </Button>
        )}
        <Button
          variant="default"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={onSaveDraft}
          loading={loading}
        >
          保存
        </Button>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={async () => {
            if (status !== 'published') {
              if (!(await myModal.confirm({ message: `确定要发布此${entityLabel}吗？` }))) return
            }
            await onPublish()
          }}
          loading={loading}
        >
          发布
        </Button>
      </Group>

      <Group mb="lg">
        <Button
          variant="subtle"
          component={Link}
          href={backUrl}
          leftSection={<IconArrowLeft size={16} />}
        >
          返回
        </Button>
        <Title order={3}>
          {entityId ? '编辑' : '新建'}
          {entityLabel}
        </Title>
        {entityId && (
          <Badge
            color={status === 'published' ? 'green' : status === 'scheduled' ? 'blue' : 'gray'}
            variant="light"
            size="lg"
          >
            {status === 'published' ? '已发布' : status === 'scheduled' ? '定时发布' : '草稿'}
          </Badge>
        )}
        {dirty && (
          <Group gap={4}>
            <Badge color="orange" variant="light" size="lg">
              已修改
            </Badge>
            {entityId && status === 'published' && (
              <IconX
                size={16}
                color="var(--mantine-color-orange-6)"
                style={{ cursor: 'pointer' }}
                onClick={async () => {
                  if (!(await myModal.confirm({ message: '是否要放弃所有未发布的修改？' }))) return
                  await onDiscardDraft()
                }}
              />
            )}
          </Group>
        )}
        {autoSaveTime && (
          <Text size="sm" c="dimmed">
            自动保存：{dayjs(autoSaveTime).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        )}
      </Group>
    </>
  )
}
