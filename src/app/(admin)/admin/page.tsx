import { db } from '@/server/db'
import { comments, contents, guestbookMessages, users } from '@/server/db/schema'
import { Box, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import {
  IconAlertCircle,
  IconFileText,
  IconMailbox,
  IconMessage,
  IconUsers,
} from '@tabler/icons-react'
import { and, count, eq, isNull } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import DashboardActivityLogs from './_components/DashboardActivityLogs'

async function getStats() {
  const [postCount] = await db
    .select({ value: count() })
    .from(contents)
    .where(and(eq(contents.type, 'post'), isNull(contents.deletedAt)))
  const [commentCount] = await db
    .select({ value: count() })
    .from(comments)
    .where(isNull(comments.deletedAt))
  const [pendingCommentCount] = await db
    .select({ value: count() })
    .from(comments)
    .where(and(eq(comments.status, 'pending'), isNull(comments.deletedAt)))
  const [guestbookCount] = await db
    .select({ value: count() })
    .from(guestbookMessages)
    .where(isNull(guestbookMessages.deletedAt))
  const [userCount] = await db.select({ value: count() }).from(users)

  return {
    posts: postCount.value,
    comments: commentCount.value,
    pendingComments: pendingCommentCount.value,
    guestbook: guestbookCount.value,
    users: userCount.value,
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()
  const t = await getTranslations('admin.dashboard')

  const statCards = [
    {
      key: 'posts',
      title: t('stats.posts'),
      value: stats.posts,
      icon: IconFileText,
      color: 'blue',
    },
    {
      key: 'comments',
      title: t('stats.comments'),
      value: stats.comments,
      icon: IconMessage,
      color: 'green',
    },
    {
      key: 'pendingComments',
      title: t('stats.pendingComments'),
      value: stats.pendingComments,
      icon: IconAlertCircle,
      color: 'orange',
    },
    {
      key: 'guestbook',
      title: t('stats.guestbook'),
      value: stats.guestbook,
      icon: IconMailbox,
      color: 'violet',
    },
    { key: 'users', title: t('stats.users'), value: stats.users, icon: IconUsers, color: 'teal' },
  ]

  return (
    <Box mt="md" data-role="admin-dashboard-page">
      <Title order={3} mb="lg" data-role="admin-dashboard-title">
        {t('title')}
      </Title>

      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 5 }}>
          {statCards.map((stat) => (
            <Paper key={stat.key} withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
                    {stat.title}
                  </Text>
                  <Text fw={700} fz="xl">
                    {stat.value}
                  </Text>
                </div>
                <ThemeIcon color={stat.color} variant="light" size={38} radius="md">
                  <stat.icon size={22} stroke={1.5} />
                </ThemeIcon>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <DashboardActivityLogs />
      </Stack>
    </Box>
  )
}
