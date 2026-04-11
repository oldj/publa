'use client'

import { notify } from '@/lib/notify'
import { Button, Drawer, Group, Stack, Textarea, TextInput } from '@mantine/core'
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
  theme: { title: '主题', apiBase: '/api/themes' },
  'custom-style': { title: '自定义 CSS', apiBase: '/api/custom-styles' },
}

export function StyleDrawer({ opened, onClose, kind, initial, onSaved }: StyleDrawerProps) {
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
  const drawerTitle = `${isEditing ? '编辑' : '新建'}${title}`

  const handleSubmit = async () => {
    if (!name.trim()) {
      notify({ color: 'red', message: '名称不能为空' })
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
        notify({ color: 'green', message: isEditing ? '更新成功' : '创建成功' })
        // 新建成功后记住返回的 id，后续保存自动转为编辑模式，避免重复创建
        if (!isEditing && typeof json.data?.id === 'number') {
          setCurrentId(json.data.id)
        }
        onSaved()
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={drawerTitle}
    >
      <Stack gap="md">
        <TextInput
          label="名称"
          placeholder={kind === 'theme' ? '主题名称' : '自定义 CSS 名称'}
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Textarea
          label="CSS"
          placeholder="/* 输入 CSS 内容 */"
          value={css}
          onChange={(e) => setCss(e.currentTarget.value)}
          minRows={20}
          maxRows={30}
          autosize
          styles={{
            input: {
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 13,
              lineHeight: 1.5,
            },
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEditing ? '保存' : '创建'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
