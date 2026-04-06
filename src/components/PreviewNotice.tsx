'use client'

import { useState } from 'react'

/** 预览页面挂载时显示一条固定提示条，可关闭 */
export default function PreviewNotice() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className="preview-notice">
      <span>预览模式 — 当前页面仅管理员或编辑可见</span>
      <button className="preview-notice-close" onClick={() => setVisible(false)}>
        ✕
      </button>
    </div>
  )
}
