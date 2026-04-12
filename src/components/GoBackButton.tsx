'use client'

import { IconArrowLeft } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

const GoBackButton = () => {
  const t = useTranslations('frontend.goBackButton')
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
      {t('label')}
    </button>
  )
}

export default GoBackButton
