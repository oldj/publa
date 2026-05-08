'use client'

import CodeEditor from '@/components/editors/CodeEditor'
import { SafeDrawer } from '@/components/SafeDrawer'
import { notify } from '@/lib/notify'
import { Button, Group, Stack, TextInput } from '@mantine/core'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

export type StyleKind = 'theme' | 'custom-style'

export interface StyleFormInitial {
  id?: number
  name: string
  css: string
}

interface StyleDrawerProps {
  opened: boolean
  onClose: () => void
  kind: StyleKind
  initial: StyleFormInitial | null
  onSaved: () => void
}

const KIND_LABEL: Record<StyleKind, { title: string; apiBase: string }> = {
  theme: { title: 'themeTitle', apiBase: '/api/themes' },
  'custom-style': { title: 'customStyleTitle', apiBase: '/api/custom-styles' },
}

export function StyleDrawer({ opened, onClose, kind, initial, onSaved }: StyleDrawerProps) {
  const t = useTranslations('admin.appearancePage.styleDrawer')
  const tCommon = useTranslations('common')
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [css, setCss] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (opened) {
      setCurrentId(initial?.id ?? null)
      setName(initial?.name ?? '')
      setCss(initial?.css ?? '')
    }
  }, [opened, initial])

  const { title, apiBase } = KIND_LABEL[kind]
  const isEditing = currentId !== null
  const drawerTitle = `${isEditing ? t('editPrefix') : t('createPrefix')}${t(title)}`

  const handleSubmit = async () => {
    if (!name.trim()) {
      notify({ color: 'red', message: tCommon('errors.validation') })
      return
    }

    setSaving(true)
    try {
      const url = isEditing ? `${apiBase}/${currentId}` : apiBase
      const method = isEditing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), css }),
      })
      const json = await res.json()
      if (json.success) {
        notify({
          color: 'green',
          message: isEditing
            ? tCommon('messages.updateSuccess')
            : tCommon('messages.createSuccess'),
        })
        // 新建成功后记住返回的 id，后续保存自动转为编辑模式，避免重复创建
        if (!isEditing && typeof json.data?.id === 'number') {
          setCurrentId(json.data.id)
        }
        onSaved()
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeDrawer opened={opened} onClose={onClose} position="right" size="lg" title={drawerTitle}>
      <Stack gap="md" data-role="appearance-style-drawer">
        <TextInput
          label={t('name')}
          placeholder={
            kind === 'theme' ? t('themeNamePlaceholder') : t('customStyleNamePlaceholder')
          }
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <CodeEditor
          language="css"
          label="CSS"
          placeholder={t('cssPlaceholder')}
          value={css}
          onChange={setCss}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEditing ? tCommon('actions.save') : tCommon('actions.create')}
          </Button>
        </Group>
      </Stack>
    </SafeDrawer>
  )
}
