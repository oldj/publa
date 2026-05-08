'use client'

import { useCurrentUser } from '@/app/(admin)/_components/AdminCountsContext'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { PageHeader } from '@/app/(admin)/_components/PageHeader'
import { RoleLabel } from '@/app/(admin)/_components/RoleLabel'
import { notify } from '@/lib/notify'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconInfoCircle, IconSend } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface User {
  id: number
  username: string
  email: string | null
  role: string
}

interface NotifyConfig {
  enabled: boolean
  userIds: number[]
}

const DEFAULT_NOTIFY: NotifyConfig = { enabled: false, userIds: [] }
const SENSITIVE_KEYS = ['emailResendApiKey', 'emailSmtpPassword']

function parseNotifyConfig(value: unknown): NotifyConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_NOTIFY }
  const obj = value as Record<string, unknown>
  return {
    enabled: !!obj.enabled,
    userIds: Array.isArray(obj.userIds) ? obj.userIds : [],
  }
}

export default function EmailSettingsPage() {
  const t = useTranslations('admin.emailPage')
  const tCommon = useTranslations('common')
  const tApiEmail = useTranslations('admin.api.email')
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const currentUser = useCurrentUser()
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const initialRef = useRef<{
    settings: Record<string, unknown>
    comment: NotifyConfig
    guestbook: NotifyConfig
  }>({
    settings: {},
    comment: { ...DEFAULT_NOTIFY },
    guestbook: { ...DEFAULT_NOTIFY },
  })

  // 已配置的敏感字段（API 返回了掩码值）
  const [configuredSecrets, setConfiguredSecrets] = useState<Set<string>>(new Set())

  // 通知配置
  const [commentNotify, setCommentNotify] = useState<NotifyConfig>({ ...DEFAULT_NOTIFY })
  const [guestbookNotify, setGuestbookNotify] = useState<NotifyConfig>({ ...DEFAULT_NOTIFY })

  const fetchData = useCallback(() => {
    fetch('/api/email-settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          // 敏感字段：记录已配置状态，并清空掩码值
          const configured = new Set<string>()
          for (const key of SENSITIVE_KEYS) {
            if (json.data[key]) {
              configured.add(key)
              json.data[key] = ''
            }
          }
          setConfiguredSecrets(configured)
          setSettings(json.data)
          const cn = parseNotifyConfig(json.data.emailNotifyNewComment)
          const gn = parseNotifyConfig(json.data.emailNotifyNewGuestbook)
          setCommentNotify(cn)
          setGuestbookNotify(gn)
          initialRef.current = { settings: { ...json.data }, comment: cn, guestbook: gn }
        }
      })
    fetch('/api/users')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data)
      })
  }, [])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return
    fetchData()
  }, [currentUser, fetchData])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const setField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const provider = String(settings.emailProvider ?? '')

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        ...settings,
        emailNotifyNewComment: commentNotify,
        emailNotifyNewGuestbook: guestbookNotify,
      }
      // 敏感字段为空时不提交，避免覆盖已有值
      for (const key of SENSITIVE_KEYS) {
        if (!payload[key]) delete payload[key]
      }
      const res = await fetch('/api/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: tCommon('save.success') })
        // 更新已配置的敏感字段状态
        setConfiguredSecrets((prev) => {
          const next = new Set(prev)
          for (const key of SENSITIVE_KEYS) {
            if (settings[key]) {
              next.add(key)
              settings[key] = '' // 保存后清空输入
            }
          }
          return next
        })
        initialRef.current = {
          settings: { ...settings },
          comment: { ...commentNotify },
          guestbook: { ...guestbookNotify },
        }
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    if (!testTo) {
      notify({ color: 'red', message: tApiEmail('recipientRequired') })
      return
    }
    setTestLoading(true)
    try {
      const res = await fetch('/api/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo }),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: t('messages.testSent') })
      } else {
        notify({ color: 'red', message: json.message || tApiEmail('sendFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setTestLoading(false)
    }
  }

  const toggleNotifyUser = (
    config: NotifyConfig,
    setConfig: (c: NotifyConfig) => void,
    userId: number,
  ) => {
    const userIds = config.userIds.includes(userId)
      ? config.userIds.filter((id) => id !== userId)
      : [...config.userIds, userId]
    setConfig({ ...config, userIds })
  }

  const renderUserCheckboxes = (config: NotifyConfig, setConfig: (c: NotifyConfig) => void) => (
    <Box
      mt="xs"
      ml="md"
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: 'var(--mantine-color-white)',
      }}
    >
      <Stack gap="xs">
        {users.map((user) => {
          const noEmail = !user.email
          const checkbox = (
            <Checkbox
              label={
                <Group gap="xs">
                  <span>{user.username}</span>
                  <RoleLabel role={user.role} />
                  {user.email && (
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                  )}
                  {noEmail && (
                    <Badge size="xs" color="yellow" variant="light">
                      {t('labels.noEmail')}
                    </Badge>
                  )}
                </Group>
              }
              checked={config.userIds.includes(user.id)}
              onChange={() => toggleNotifyUser(config, setConfig, user.id)}
              // styles={
              //   noEmail
              //     ? {
              //         body: {
              //           backgroundColor: 'var(--mantine-color-yellow-0)',
              //           border: '1px solid var(--mantine-color-yellow-4)',
              //           borderRadius: 'var(--mantine-radius-sm)',
              //           padding: '4px 8px',
              //         },
              //       }
              //     : undefined
              // }
            />
          )

          if (noEmail) {
            return (
              <Tooltip key={user.id} label={t('tooltips.noEmail')} position="right">
                {checkbox}
              </Tooltip>
            )
          }
          return <Box key={user.id}>{checkbox}</Box>
        })}
      </Stack>
    </Box>
  )

  const isDirty =
    Object.keys(settings).some(
      (key) =>
        JSON.stringify(settings[key]) !== JSON.stringify(initialRef.current.settings[key] ?? ''),
    ) ||
    commentNotify.enabled !== initialRef.current.comment.enabled ||
    JSON.stringify(commentNotify.userIds) !== JSON.stringify(initialRef.current.comment.userIds) ||
    guestbookNotify.enabled !== initialRef.current.guestbook.enabled ||
    JSON.stringify(guestbookNotify.userIds) !== JSON.stringify(initialRef.current.guestbook.userIds)

  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} dirty={isDirty} loading={loading} onSave={handleSave} />
      {/* 邮件发送配置 */}
      <Divider label={t('sections.sendingConfig')} labelPosition="left" />
      <Box>
        <Text fw={500} mb="xs">
          {t('fields.sendMethod')}
        </Text>
        <SegmentedControl
          value={provider}
          onChange={(v) => setField('emailProvider', v)}
          data={[
            { label: t('providers.disabled'), value: '' },
            { label: t('providers.resend'), value: 'resend' },
            { label: t('providers.smtp'), value: 'smtp' },
          ]}
        />
      </Box>
      {provider && (
        <TextInput
          label={t('fields.fromAddress')}
          description={provider === 'resend' ? t('descriptions.fromAddress') : ''}
          placeholder="noreply@example.com"
          value={String(settings.emailSmtpFrom ?? '')}
          onChange={(e) => setField('emailSmtpFrom', e.currentTarget.value)}
        />
      )}
      {provider === 'resend' && (
        <PasswordInput
          label={t('fields.resendApiKey')}
          description={t('descriptions.resendApiKey')}
          placeholder={
            configuredSecrets.has('emailResendApiKey')
              ? t('descriptions.configuredPlaceholder')
              : 're_...'
          }
          value={String(settings.emailResendApiKey ?? '')}
          onChange={(e) => setField('emailResendApiKey', e.currentTarget.value)}
        />
      )}
      {provider === 'smtp' && (
        <>
          <Group grow>
            <TextInput
              label={t('fields.smtpHost')}
              placeholder="smtp.example.com"
              value={String(settings.emailSmtpHost ?? '')}
              onChange={(e) => setField('emailSmtpHost', e.currentTarget.value)}
            />
            <TextInput
              label={t('fields.smtpPort')}
              placeholder="587"
              value={String(settings.emailSmtpPort ?? '')}
              onChange={(e) => setField('emailSmtpPort', e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t('fields.username')}
              value={String(settings.emailSmtpUsername ?? '')}
              onChange={(e) => setField('emailSmtpUsername', e.currentTarget.value)}
            />
            <PasswordInput
              label={t('fields.password')}
              placeholder={
                configuredSecrets.has('emailSmtpPassword')
                  ? t('descriptions.configuredPlaceholder')
                  : ''
              }
              value={String(settings.emailSmtpPassword ?? '')}
              onChange={(e) => setField('emailSmtpPassword', e.currentTarget.value)}
            />
          </Group>
          <Select
            label={t('fields.encryption')}
            value={String(settings.emailSmtpEncryption ?? 'tls')}
            onChange={(v) => setField('emailSmtpEncryption', v || 'tls')}
            data={[
              { label: t('encryptionOptions.tls'), value: 'tls' },
              { label: t('encryptionOptions.ssl'), value: 'ssl' },
              { label: t('encryptionOptions.none'), value: 'none' },
            ]}
          />
        </>
      )}
      {provider && (
        <>
          <Divider label={t('sections.testSend')} labelPosition="left" />
          {isDirty && (
            <Text size="sm" c="orange">
              {t('hints.saveBeforeTest')}
            </Text>
          )}
          <Group align="flex-end">
            <TextInput
              label={t('fields.recipientEmail')}
              placeholder="name@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconSend size={16} />}
              variant="light"
              onClick={handleSendTest}
              loading={testLoading}
            >
              {t('buttons.sendTest')}
            </Button>
          </Group>
        </>
      )}
      {/* 通知事件配置 */}
      <Divider label={t('sections.events')} labelPosition="left" />
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        {t('hints.events')}
      </Alert>
      <Box>
        <Switch
          label={t('events.newComment')}
          checked={commentNotify.enabled}
          onChange={(e) => setCommentNotify({ ...commentNotify, enabled: e.currentTarget.checked })}
        />
        {commentNotify.enabled && renderUserCheckboxes(commentNotify, setCommentNotify)}
      </Box>
      <Box>
        <Switch
          label={t('events.newGuestbook')}
          checked={guestbookNotify.enabled}
          onChange={(e) =>
            setGuestbookNotify({ ...guestbookNotify, enabled: e.currentTarget.checked })
          }
        />
        {guestbookNotify.enabled && renderUserCheckboxes(guestbookNotify, setGuestbookNotify)}
      </Box>
    </Stack>
  )
}
