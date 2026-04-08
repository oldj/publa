import { Box } from '@mantine/core'
import PostEditor from '../_components/PostEditor'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Box mt="md">
      <PostEditor postId={parseInt(id)} />
    </Box>
  )
}
