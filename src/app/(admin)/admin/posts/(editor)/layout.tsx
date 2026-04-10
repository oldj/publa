'use client'

import { Box } from '@mantine/core'
import { useSelectedLayoutSegment } from 'next/navigation'
import type { ReactNode } from 'react'
import PostEditor from '../_components/PostEditor'

function parsePostId(segment: string | null): number | undefined {
  if (!segment || segment === 'new') {
    return undefined
  }

  const value = Number.parseInt(segment, 10)
  return Number.isFinite(value) ? value : undefined
}

export default function PostEditorLayout({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment()

  return (
    <Box mt="md">
      <PostEditor postId={parsePostId(segment)} />
      {children}
    </Box>
  )
}
