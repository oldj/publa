'use client'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { PostList } from '@/app/(admin)/_components/PostList'
import { Box, Button, Group, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function PostsPage() {
  const t = useTranslations('admin.postsPage')
  const adminUrl = useAdminUrl()

  return (
    <Box mt="md" data-role="admin-posts-page">
      <Group justify="space-between" mb="lg">
        <Title order={3} data-role="admin-posts-page-title">
          {t('title')}
        </Title>
        <Button
          component={Link}
          href={adminUrl('/posts/new')}
          leftSection={<IconPlus size={16} />}
          data-role="admin-posts-new-button"
        >
          {t('newPost')}
        </Button>
      </Group>

      <PostList />
    </Box>
  )
}
