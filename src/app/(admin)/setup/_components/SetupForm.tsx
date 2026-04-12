'use client'

import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import type { Locale } from '@/i18n/locales'
import { notify } from '@/lib/notify'
import { normalizeEmail, normalizePassword, normalizeUsername } from '@/lib/user-input'
import { version } from '@/lib/version'
import { Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LanguageSelect } from './LanguageSelect'

interface SetupFormProps {
  /**
   * 由 server 壳解析后传入的当前 locale。每次用户通过 LanguageSelect 切换 ?lang=
   * 时，server 会重新渲染并注入新的值，React 会保留本组件的表单 state 只更新此 prop。
   */
  currentLocale: Locale
}

export function SetupForm({ currentLocale }: SetupFormProps) {
  const t = useTranslations('admin.setup')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const adminUrl = useAdminUrl()
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
      notify({ color: 'red', message: t('errors.usernameOrPasswordEmpty') })
      return
    }

    if (password.length < 6) {
      notify({ color: 'red', message: t('errors.passwordTooShort') })
      return
    }

    if (password !== confirmPassword) {
      notify({ color: 'red', message: t('errors.passwordMismatch') })
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
          language: currentLocale,
        }),
      })
      const data = await res.json()

      if (data.success) {
        notify({ color: 'green', message: t('success') })
        router.push(adminUrl())
      } else {
        notify({ color: 'red', message: data.message || t('errors.setupFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size={420} my={80}>
      <Title ta="center">{t('title')}</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        {t('subtitle')}
      </Text>

      <Paper withBorder shadow="sm" p={22} pb={40} mt={30} radius="md">
        <LanguageSelect value={currentLocale} label={t('fields.language')} />

        <form onSubmit={handleSubmit}>
          <TextInput
            label={t('fields.username')}
            placeholder={t('fields.usernamePlaceholder')}
            required
            radius="md"
            mt="md"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <TextInput
            label={t('fields.email')}
            placeholder={t('fields.emailPlaceholder')}
            mt="md"
            radius="md"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <PasswordInput
            label={t('fields.password')}
            placeholder={t('fields.passwordPlaceholder')}
            required
            mt="md"
            radius="md"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <PasswordInput
            label={t('fields.confirmPassword')}
            placeholder={t('fields.confirmPasswordPlaceholder')}
            required
            mt="md"
            radius="md"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          <Button fullWidth mt="xl" radius="md" type="submit" loading={loading}>
            {tCommon('actions.submit')}
          </Button>
        </form>
      </Paper>

      <Text c="dimmed" size="xs" ta="center" mt="xl">
        {version}
      </Text>
    </Container>
  )
}
