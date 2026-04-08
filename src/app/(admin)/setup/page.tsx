'use client'

import { notify } from '@/lib/notify'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { version } from '@/lib/version'
import { Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const username = normalizeUsername(form.username)
    const email = normalizeEmail(form.email)
    const password = normalizePassword(form.password)
    const confirmPassword = normalizePassword(form.confirmPassword)

    if (!username || !password) {
      notify({ color: 'red', message: '用户名和密码不能为空' })
      return
    }

    if (password.length < 6) {
      notify({ color: 'red', message: '密码长度至少 6 位' })
      return
    }

    if (password !== confirmPassword) {
      notify({ color: 'red', message: '两次密码输入不一致' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      })
      const data = await res.json()

      if (data.success) {
        notify({ color: 'green', message: '初始化成功，即将跳转到后台' })
        router.push('/admin')
      } else {
        notify({ color: 'red', message: data.message || '初始化失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">Publa 初始化</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        创建管理员账号以开始使用
      </Text>

      <Paper withBorder shadow="sm" p={22} pb={40} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="用户名"
            placeholder="admin"
            required
            radius="md"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextInput
            label="邮箱"
            placeholder="admin@example.com"
            mt="md"
            radius="md"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <PasswordInput
            label="密码"
            placeholder="至少 6 位"
            required
            mt="md"
            radius="md"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <PasswordInput
            label="确认密码"
            placeholder="再次输入密码"
            required
            mt="md"
            radius="md"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          <Button fullWidth mt="xl" radius="md" type="submit" loading={loading}>
            提交
          </Button>
        </form>
      </Paper>

      <Text c="dimmed" size="xs" ta="center" mt="xl">
        {version}
      </Text>
    </Container>
  )
}
