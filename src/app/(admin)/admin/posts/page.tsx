'use client'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { PostList } from '@/app/(admin)/_components/PostList'
import { Box, Button, Group, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'

export default function PostsPage() {
  const adminUrl = useAdminUrl()

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>文章管理</Title>
        <Button component={Link} href={adminUrl('/posts/new')} leftSection={<IconPlus size={16} />}>
          新建文章
        </Button>
      </Group>

      <PostList />
    </Box>
  )
}
