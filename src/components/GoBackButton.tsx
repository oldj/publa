'use client'

import { Button } from '@mantine/core'
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
    <Button
      leftSection={<IconArrowLeft />}
      variant="filled"
      size="md"
      onClick={() => {
        window.history.back()
      }}
    >
      返回上一页
    </Button>
  )
}

export default GoBackButton
