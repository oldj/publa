'use client'

import { notifications } from '@mantine/notifications'
import { IconEye } from '@tabler/icons-react'
import { useEffect } from 'react'

/** 预览页面挂载时显示一条持久 toast 提示 */
export default function PreviewNotice() {
  useEffect(() => {
    notifications.show({
      id: 'preview-notice',
      title: '预览模式',
      message: '当前页面为预览，仅管理员或编辑可见。',
      color: 'orange',
      icon: <IconEye size={18} />,
      autoClose: false,
      withCloseButton: true,
    })

    return () => {
      notifications.hide('preview-notice')
    }
  }, [])

  return null
}
