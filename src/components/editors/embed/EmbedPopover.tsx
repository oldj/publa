'use client'

import { ActionIcon, Popover, Text, TextInput, Tooltip } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import {
  IconBrandYoutube,
  IconCornerDownLeft,
  IconExternalLink,
  IconTrash,
} from '@tabler/icons-react'
import type { Editor } from '@tiptap/react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PROVIDERS, detectProvider } from './providers'

// 嵌入 Popover hook，整体参考 LinkPopover 的 useLinkPopover 结构
function useEmbedPopover(editor: Editor | null) {
  const [url, setUrl] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [error, setError] = useState<'' | 'invalidUrl' | 'unsupported'>('')
  // 操作后短暂忽略 selectionUpdate，防止 popover 被重新打开
  const suppressUntilRef = useRef(0)

  useEffect(() => {
    if (!editor) return

    const onSelectionUpdate = () => {
      if (Date.now() < suppressUntilRef.current) return

      const active = editor.isActive('embed')
      setIsActive(active)
      if (active) {
        const attrs = editor.getAttributes('embed')
        // 优先回填原始 URL；老节点没有 origin 时退化到 src
        setUrl(attrs.origin || attrs.src || '')
        setError('')
        setIsOpen(true)
        setManualOpen(false)
      } else {
        setIsOpen(false)
        setManualOpen(false)
      }
    }

    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [editor])

  const openPopover = useCallback(() => {
    if (!editor) return
    const active = editor.isActive('embed')
    setIsActive(active)
    if (active) {
      const attrs = editor.getAttributes('embed')
      setUrl(attrs.origin || attrs.src || '')
    } else {
      setUrl('')
    }
    setError('')
    setIsOpen(true)
    setManualOpen(true)
  }, [editor])

  const closePopover = useCallback(() => {
    setIsOpen(false)
    setManualOpen(false)
    setError('')
  }, [])

  const apply = useCallback(() => {
    if (!editor) return
    const trimmed = url.trim()
    if (!trimmed) {
      setError('invalidUrl')
      return
    }
    const detected = detectProvider(trimmed)
    if (!detected) {
      setError('unsupported')
      return
    }
    suppressUntilRef.current = Date.now() + 200
    const attrs = { src: detected.src, provider: detected.provider.id, origin: trimmed }
    if (isActive) {
      editor.chain().focus().updateEmbed(attrs).run()
    } else {
      editor.chain().focus().setEmbed(attrs).run()
    }
    setIsOpen(false)
    setManualOpen(false)
    setError('')
  }, [editor, url, isActive])

  const remove = useCallback(() => {
    if (!editor) return
    suppressUntilRef.current = Date.now() + 200
    editor.chain().focus().deleteSelection().run()
    setUrl('')
    setIsOpen(false)
    setIsActive(false)
    setManualOpen(false)
    setError('')
  }, [editor])

  const openOriginal = useCallback(() => {
    if (!editor) return
    const attrs = editor.getAttributes('embed')
    // 优先跳到用户原始输入 URL（人类可读页面）；老节点没有 origin 时退化到 src
    const target = attrs.origin || attrs.src
    if (!target) return
    window.open(target, '_blank', 'noopener,noreferrer')
  }, [editor])

  return {
    url,
    setUrl,
    isOpen,
    isActive,
    manualOpen,
    error,
    setError,
    openPopover,
    closePopover,
    apply,
    remove,
    openOriginal,
  }
}

// 嵌入 Popover 组件，UX 模式与 LinkPopover 保持一致
export default function EmbedPopoverControl({ editor }: { editor: Editor | null }) {
  const t = useTranslations('admin.editor.embedPopover')
  const {
    url,
    setUrl,
    isOpen,
    isActive,
    manualOpen,
    error,
    setError,
    openPopover,
    closePopover,
    apply,
    remove,
    openOriginal,
  } = useEmbedPopover(editor)

  // {list} 文案：运行期从 PROVIDERS 拼接，新增站点自动生效
  const providerList = useMemo(() => PROVIDERS.map((p) => t(`providers.${p.id}`)).join(', '), [t])

  const handleClick = useCallback(() => {
    if (isOpen) {
      closePopover()
    } else {
      openPopover()
    }
  }, [isOpen, openPopover, closePopover])

  return (
    <Popover
      opened={isOpen}
      onChange={(opened) => {
        if (!opened) closePopover()
      }}
      trapFocus={manualOpen}
      shadow="md"
      withinPortal
      zIndex={10000}
      position="bottom"
    >
      <Popover.Target>
        <RichTextEditor.Control
          onClick={handleClick}
          active={isOpen || isActive}
          title={t('insertEmbed')}
        >
          <IconBrandYoutube size={16} />
        </RichTextEditor.Control>
      </Popover.Target>
      <Popover.Dropdown style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 420, alignItems: 'center' }}>
          <TextInput
            placeholder={t('placeholder', { list: providerList })}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
              if (e.key === 'Escape') {
                closePopover()
              }
            }}
            style={{ flex: 1 }}
            size="sm"
            error={error ? true : undefined}
            rightSection={
              <Tooltip label={t('apply')} withArrow zIndex={10001}>
                <ActionIcon variant="subtle" size="sm" onClick={apply} disabled={!url}>
                  <IconCornerDownLeft size={14} />
                </ActionIcon>
              </Tooltip>
            }
          />

          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: 'var(--mantine-color-gray-3)',
            }}
          />

          <Tooltip label={t('openOriginal')} withArrow zIndex={10001}>
            <ActionIcon variant="subtle" size="sm" onClick={openOriginal} disabled={!isActive}>
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('remove')} withArrow zIndex={10001}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={remove}
              disabled={!isActive}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </div>

        {error && (
          <Text size="xs" c="red" mt={6}>
            {error === 'unsupported' ? t('unsupported', { list: providerList }) : t('invalidUrl')}
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}
