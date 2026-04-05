import '@/styles/globals.scss'
import GoBackButton from '@/components/GoBackButton'
import { Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import '@mantine/core/styles.css'
import { IconHome } from '@tabler/icons-react'

export const metadata = {
  title: '404 - Page Not Found',
}

export default async function NotFound() {
  return (
    <Container size="md" py={40}>
      <Stack align="center" gap="xl">
        {/*<Image src={'/images/404.svg'} alt={'404'} width={400} height={300} />*/}
        <Title order={1} size="h3" ta="center">
          404 - 页面没有找到
        </Title>
        <Text size="md" c="dimmed" ta="center" maw={580}>
          这个页面不存在或者已过期。
        </Text>
        <Group>
          <Button leftSection={<IconHome />} variant="filled" size="md" component="a" href="/">
            首页
          </Button>
          <GoBackButton />
        </Group>
      </Stack>
    </Container>
  )
}
