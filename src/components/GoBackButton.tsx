'use client'

import { IconArrowLeft } from '@tabler/icons-react'
import { useState, useEffect } from 'react'

const GoBackButton = () => {
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    setHasHistory(window.history.length > 1)
  }, [])

  if (!hasHistory) {
    return null
  }

  return (
    <button
      className="not-found-btn"
      onClick={() => {
        window.history.back()
      }}
    >
      <IconArrowLeft size={18} />
      返回上一页
    </button>
  )
}

export default GoBackButton
