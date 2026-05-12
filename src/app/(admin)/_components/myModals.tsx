'use client'

import { getClientTranslator } from '@/i18n/client-runtime'
import { Button, Group, PasswordInput, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useRef, useState } from 'react'

interface ModalOptions {
  title?: string | null
  message?: React.ReactNode
  okText?: string
  cancelText?: string
}

function renderMessage(message: React.ReactNode): React.ReactNode {
  if (typeof message !== 'string') return message
  return message.split('\n').flatMap((part, i) => (i === 0 ? [part] : [<br key={i} />, part]))
}

function getTitle(title: string | null | undefined): string | undefined {
  const tCommon = getClientTranslator('common')
  if (title === null) return undefined
  return title || tCommon('modal.title')
}

async function alert(options: ModalOptions): Promise<boolean> {
  const tCommon = getClientTranslator('common')
  return new Promise((resolve) => {
    let resolved = false
    const id = modals.open({
      title: getTitle(options.title),
      centered: true,
      withCloseButton: false,
      children: (
        <Stack>
          <div>{renderMessage(options.message)}</div>
          <Button
            fullWidth
            onClick={() => {
              resolved = true
              resolve(true)
              modals.close(id)
            }}
          >
            {options.okText || tCommon('actions.confirm')}
          </Button>
        </Stack>
      ),
      onClose: () => {
        if (!resolved) resolve(true)
      },
    })
  })
}

async function confirm(options: ModalOptions): Promise<boolean> {
  const tCommon = getClientTranslator('common')
  return new Promise((resolve) => {
    let resolved = false
    modals.openConfirmModal({
      title: getTitle(options.title),
      centered: true,
      withCloseButton: options.title !== null,
      children: <div>{renderMessage(options.message)}</div>,
      labels: {
        confirm: options.okText || tCommon('actions.confirm'),
        cancel: options.cancelText || tCommon('actions.cancel'),
      },
      onCancel: () => {
        resolved = true
        resolve(false)
      },
      onConfirm: () => {
        resolved = true
        resolve(true)
      },
      onClose: () => {
        if (!resolved) resolve(false)
      },
    })
  })
}

function ReauthModalContent({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void
  onSuccess: () => void
}) {
  const tCommon = getClientTranslator('common')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const submit = async () => {
    if (loadingRef.current) return

    const currentPassword = password.trim()
    if (!currentPassword) {
      setError(tCommon('reauth.passwordRequired'))
      return
    }

    let shouldResetLoading = true
    loadingRef.current = true
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      })
      const json = await response.json()
      if (json.success) {
        // 成功后立即清空密码，避免明文在组件状态中残留
        setPassword('')
        shouldResetLoading = false
        onSuccess()
        return
      }
      setError(json.message || tCommon('reauth.invalidPassword'))
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      if (shouldResetLoading) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }

  return (
    <Stack>
      <Text size="sm">{tCommon('reauth.message')}</Text>
      <PasswordInput
        autoFocus
        label={tCommon('reauth.passwordLabel')}
        value={password}
        error={error || undefined}
        onChange={(event) => setPassword(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit()
          }
        }}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          {tCommon('actions.cancel')}
        </Button>
        <Button onClick={() => void submit()} loading={loading}>
          {tCommon('reauth.submit')}
        </Button>
      </Group>
    </Stack>
  )
}

// 模块级单例：并发触发 reauth() 时复用同一弹窗，避免叠出多个密码框，
// 也避免「用户输入一次密码却让多个独立请求都通过」的歧义状态。
let pendingReauth: Promise<boolean> | null = null

function reauth(): Promise<boolean> {
  if (pendingReauth) return pendingReauth
  const tCommon = getClientTranslator('common')
  // 不使用 async 关键字：async 包装会返回一份新 Promise，无法把原始 Promise 引用
  // 暴露出去，破坏并发场景下「同一个 promise 复用」的语义。
  pendingReauth = new Promise<boolean>((resolve) => {
    let resolved = false
    const id = modals.open({
      title: tCommon('reauth.title'),
      centered: true,
      withCloseButton: false,
      closeOnClickOutside: false,
      children: (
        <ReauthModalContent
          onCancel={() => {
            resolved = true
            resolve(false)
            modals.close(id)
          }}
          onSuccess={() => {
            resolved = true
            resolve(true)
            modals.close(id)
          }}
        />
      ),
      onClose: () => {
        if (!resolved) resolve(false)
      },
    })
  }).finally(() => {
    pendingReauth = null
  })
  return pendingReauth
}

const myModal = {
  alert,
  confirm,
  reauth,
}

export default myModal
