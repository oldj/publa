'use client'

import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { useSiteShortTitle } from '@/app/(admin)/_components/SiteShortTitleContext'
import { clearAllLocalDraftBackups } from '@/app/(admin)/admin/_lib/use-local-draft-backup'
import { notify } from '@/lib/notify'
import { normalizePassword, normalizeUsername } from '@/lib/user-input'
import { version } from '@/lib/version'
import { Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AdminLoginPage() {
  const t = useTranslations('admin.login')
  const tCommon = useTranslations('common')
  const { siteShortTitle } = useSiteShortTitle()
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
      notify({ color: 'red', message: t('errors.emptyCredentials') })
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
        // 登录成功：清空前一个账号残留的本地草稿备份
        clearAllLocalDraftBackups()
        router.push(adminUrl())
      } else {
        notify({ color: 'red', message: data.message || t('errors.loginFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{t('title', { siteShortTitle })}</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t('subtitle')}
      </Text>

      <Paper withBorder shadow="sm" p={22} pb={40} mt={30} radius="md">
        <form onSubmit={handleSubmit} data-role="admin-login-form">
          <TextInput
            label={t('fields.username')}
            placeholder={t('fields.usernamePlaceholder')}
            required
            radius="md"
            data-role="admin-login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <PasswordInput
            label={t('fields.password')}
            placeholder={t('fields.passwordPlaceholder')}
            required
            mt="md"
            radius="md"
            data-role="admin-login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            fullWidth
            mt="xl"
            radius="md"
            type="submit"
            loading={loading}
            data-role="admin-login-submit"
          >
            {t('submit')}
          </Button>
        </form>
      </Paper>

      <Text c="dimmed" size="xs" ta="center" mt="xl">
        {version}
      </Text>
    </Container>
  )
}
