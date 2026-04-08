'use client'

import { Box } from '@mantine/core'
import { use } from 'react'
import PageEditor from '../_components/PageEditor'

export default function EditPageAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Box mt="md">
      <PageEditor pageId={parseInt(id)} />
    </Box>
  )
}
