import PostEditor from '../_components/PostEditor'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PostEditor postId={parseInt(id)} />
}
