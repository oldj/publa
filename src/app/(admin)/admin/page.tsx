import { db } from '@/server/db'
import { comments, contents, guestbookMessages, users } from '@/server/db/schema'
import { Group, Paper, SimpleGrid, Text, ThemeIcon, Title } from '@mantine/core'
import {
  IconAlertCircle,
  IconFileText,
  IconMailbox,
  IconMessage,
  IconUsers,
} from '@tabler/icons-react'
import { and, count, eq, isNull } from 'drizzle-orm'

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

  const statCards = [
    { title: '文章', value: stats.posts, icon: IconFileText, color: 'blue' },
    { title: '评论', value: stats.comments, icon: IconMessage, color: 'green' },
    { title: '待审评论', value: stats.pendingComments, icon: IconAlertCircle, color: 'orange' },
    { title: '留言', value: stats.guestbook, icon: IconMailbox, color: 'violet' },
    { title: '用户', value: stats.users, icon: IconUsers, color: 'teal' },
  ]

  return (
    <div>
      <Title order={3} mb="lg">
        仪表盘
      </Title>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 5 }}>
        {statCards.map((stat) => (
          <Paper key={stat.title} withBorder p="md" radius="md">
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
    </div>
  )
}
