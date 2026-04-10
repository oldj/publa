'use client'

import { notify } from '@/lib/notify'
import { normalizePassword, normalizeUsername } from '@/lib/user-input'
import { version } from '@/lib/version'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AdminLoginPage() {
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const normalizedUsername = normalizeUsername(username)
    const normalizedPassword = normalizePassword(password)

    if (!normalizedUsername || !normalizedPassword) {
      notify({ color: 'red', message: '请输入用户名和密码' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password: normalizedPassword }),
      })
      const data = await res.json()

      if (data.success) {
        router.push(adminUrl())
      } else {
        notify({ color: 'red', message: data.message || '登录失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">Publa 管理后台</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        请输入管理员账号登录
      </Text>

      <Paper withBorder shadow="sm" p={22} pb={40} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="用户名"
            placeholder="请输入用户名"
            required
            radius="md"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <PasswordInput
            label="密码"
            placeholder="请输入密码"
            required
            mt="md"
            radius="md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button fullWidth mt="xl" radius="md" type="submit" loading={loading}>
            登录
          </Button>
        </form>
      </Paper>

      <Text c="dimmed" size="xs" ta="center" mt="xl">
        {version}
      </Text>
    </Container>
  )
}
