'use client'

import { Box } from '@mantine/core'
import { useSelectedLayoutSegment } from 'next/navigation'
import type { ReactNode } from 'react'
import PageEditor from '../_components/PageEditor'

function parsePageId(segment: string | null): number | undefined {
  if (!segment || segment === 'new') {
    return undefined
  }

  const value = Number.parseInt(segment, 10)
  return Number.isFinite(value) ? value : undefined
}

export default function PageEditorLayout({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment()

  return (
    <Box mt="md">
      <PageEditor pageId={parsePageId(segment)} />
      {children}
    </Box>
  )
}
