'use client'

import { E2ERouterBridge } from '@/app/(admin)/_components/E2ERouterBridge'
import PageEditor from '@/app/(admin)/admin/pages/_components/PageEditor'
import { Box } from '@mantine/core'
import { useSelectedLayoutSegment } from 'next/navigation'
import type { ReactNode } from 'react'

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
      <E2ERouterBridge />
      <PageEditor pageId={parsePageId(segment)} />
      {children}
    </Box>
  )
}
