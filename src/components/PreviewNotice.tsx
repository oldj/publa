'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

/** 预览页面挂载时显示一条固定提示条，可关闭 */
export default function PreviewNotice() {
  const t = useTranslations('frontend.previewNotice')
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className="preview-notice">
      <span>{t('message')}</span>
      <button className="preview-notice-close" onClick={() => setVisible(false)}>
        ✕
      </button>
    </div>
  )
}
