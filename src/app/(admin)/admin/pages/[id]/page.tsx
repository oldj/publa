'use client'

import { use } from 'react'
import PageEditor from '../_components/PageEditor'

export default function EditPageAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PageEditor pageId={parseInt(id)} />
}
