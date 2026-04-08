'use client'

import { Button, Group, Text, Title } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** 当前是否有未保存的变更 */
  dirty?: boolean
  /** 保存中 */
  loading?: boolean
  /** 保存回调 */
  onSave?: () => void
  /** 变更提示文案，默认"设置已修改，需保存后方可生效" */
  dirtyMessage?: string
  /** 保存按钮右侧的额外内容 */
  extra?: ReactNode
}

/** 管理后台页面顶栏，含标题、变更提示和保存按钮 */
export function PageHeader({
  title,
  dirty,
  loading,
  onSave,
  dirtyMessage = '设置已修改，需保存后方可生效',
  extra,
}: PageHeaderProps) {
  return (
    <Group
      justify="space-between"
      mb="lg"
      py="md"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: '#f7f7f7',
      }}
    >
      <Title order={3}>{title}</Title>
      <Group gap="sm">
        {dirty && (
          <Text size="sm" c="orange">
            {dirtyMessage}
          </Text>
        )}
        {onSave && (
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={onSave} loading={loading}>
            保存
          </Button>
        )}
        {extra}
      </Group>
    </Group>
  )
}
