'use client'

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
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import { PageHeader } from '../../_components/PageHeader'

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

function parseNotifyConfig(value: string): NotifyConfig {
  if (!value) return { ...DEFAULT_NOTIFY }
  try {
    const parsed = JSON.parse(value)
    return {
      enabled: !!parsed.enabled,
      userIds: Array.isArray(parsed.userIds) ? parsed.userIds : [],
    }
  } catch {
    return { ...DEFAULT_NOTIFY }
  }
}

export default function EmailSettingsPage() {
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const initialRef = useRef<{
    settings: Record<string, string>
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
      router.replace('/admin')
    }
  }, [currentUser, router])

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

  const provider = settings.emailProvider || ''

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload: Record<string, string> = {
        ...settings,
        emailNotifyNewComment: JSON.stringify(commentNotify),
        emailNotifyNewGuestbook: JSON.stringify(guestbookNotify),
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
        notify({ color: 'green', message: '保存成功' })
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
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    if (!testTo) {
      notify({ color: 'red', message: '请填写收件人邮箱' })
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
        notify({ color: 'green', message: '测试邮件已发送' })
      } else {
        notify({ color: 'red', message: json.message || '发送失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
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
    <Stack gap="xs" mt="xs">
      {users.map((user) => {
        const noEmail = !user.email
        const checkbox = (
          <Checkbox
            label={
              <Group gap="xs">
                <span>{user.username}</span>
                {user.email && (
                  <Text size="xs" c="dimmed">
                    {user.email}
                  </Text>
                )}
                {noEmail && (
                  <Badge size="xs" color="yellow" variant="light">
                    未设置邮箱
                  </Badge>
                )}
              </Group>
            }
            checked={config.userIds.includes(user.id)}
            onChange={() => toggleNotifyUser(config, setConfig, user.id)}
            styles={
              noEmail
                ? {
                    body: {
                      backgroundColor: 'var(--mantine-color-yellow-0)',
                      border: '1px solid var(--mantine-color-yellow-4)',
                      borderRadius: 'var(--mantine-radius-sm)',
                      padding: '4px 8px',
                    },
                  }
                : undefined
            }
          />
        )

        if (noEmail) {
          return (
            <Tooltip key={user.id} label="该用户未设置邮箱，无法接收邮件通知" position="right">
              {checkbox}
            </Tooltip>
          )
        }
        return <Box key={user.id}>{checkbox}</Box>
      })}
    </Stack>
  )

  const isDirty =
    Object.keys(settings).some(
      (key) => settings[key] !== (initialRef.current.settings[key] ?? ''),
    ) ||
    commentNotify.enabled !== initialRef.current.comment.enabled ||
    JSON.stringify(commentNotify.userIds) !== JSON.stringify(initialRef.current.comment.userIds) ||
    guestbookNotify.enabled !== initialRef.current.guestbook.enabled ||
    JSON.stringify(guestbookNotify.userIds) !== JSON.stringify(initialRef.current.guestbook.userIds)

  return (
    <Stack gap="lg">
      <PageHeader title="邮件通知" dirty={isDirty} loading={loading} onSave={handleSave} />

      {/* 邮件发送配置 */}
      <Divider label="邮件发送配置" labelPosition="left" />

      <Box>
        <Text fw={500} mb="xs">
          发送方式
        </Text>
        <SegmentedControl
          value={provider}
          onChange={(v) => setField('emailProvider', v)}
          data={[
            { label: '未启用', value: '' },
            { label: 'Resend', value: 'resend' },
            { label: 'SMTP', value: 'smtp' },
          ]}
        />
      </Box>

      {provider && (
        <TextInput
          label="发件人地址"
          description={provider === 'resend' ? '需在 Resend 控制台完成域名验证' : ''}
          placeholder="noreply@example.com"
          value={settings.emailSmtpFrom || ''}
          onChange={(e) => setField('emailSmtpFrom', e.currentTarget.value)}
        />
      )}

      {provider === 'resend' && (
        <PasswordInput
          label="Resend API Key"
          description="登录 Resend 控制台创建 API Key，具有发送权限即可"
          placeholder={
            configuredSecrets.has('emailResendApiKey') ? '已配置，留空保留原值' : 're_...'
          }
          value={settings.emailResendApiKey || ''}
          onChange={(e) => setField('emailResendApiKey', e.currentTarget.value)}
        />
      )}

      {provider === 'smtp' && (
        <>
          <Group grow>
            <TextInput
              label="SMTP 主机"
              placeholder="smtp.example.com"
              value={settings.emailSmtpHost || ''}
              onChange={(e) => setField('emailSmtpHost', e.currentTarget.value)}
            />
            <TextInput
              label="SMTP 端口"
              placeholder="587"
              value={settings.emailSmtpPort || ''}
              onChange={(e) => setField('emailSmtpPort', e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="用户名"
              value={settings.emailSmtpUsername || ''}
              onChange={(e) => setField('emailSmtpUsername', e.currentTarget.value)}
            />
            <PasswordInput
              label="密码"
              placeholder={configuredSecrets.has('emailSmtpPassword') ? '已配置，留空保留原值' : ''}
              value={settings.emailSmtpPassword || ''}
              onChange={(e) => setField('emailSmtpPassword', e.currentTarget.value)}
            />
          </Group>
          <Select
            label="加密方式"
            value={settings.emailSmtpEncryption || 'tls'}
            onChange={(v) => setField('emailSmtpEncryption', v || 'tls')}
            data={[
              { label: 'TLS (推荐)', value: 'tls' },
              { label: 'SSL', value: 'ssl' },
              { label: '无', value: 'none' },
            ]}
          />
        </>
      )}

      {provider && (
        <>
          <Divider label="发送测试" labelPosition="left" />
          {isDirty && (
            <Text size="sm" c="orange">
              请先保存配置，测试邮件将使用已保存的配置发送。
            </Text>
          )}
          <Group align="flex-end">
            <TextInput
              label="收件人邮箱"
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
              发送测试邮件
            </Button>
          </Group>
        </>
      )}

      {/* 通知事件配置 */}
      <Divider label="通知事件" labelPosition="left" />

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        选择需要发送邮件通知的事件，以及通知的接收人。发送时会跳过未设置邮箱的用户。
      </Alert>

      <Box>
        <Switch
          label="有新的评论"
          checked={commentNotify.enabled}
          onChange={(e) => setCommentNotify({ ...commentNotify, enabled: e.currentTarget.checked })}
        />
        {commentNotify.enabled && renderUserCheckboxes(commentNotify, setCommentNotify)}
      </Box>

      <Box>
        <Switch
          label="有新的留言"
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
