'use client'

import { ActionIcon, Popover, TextInput, Tooltip } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { IconCornerDownLeft, IconExternalLink, IconLink, IconLinkOff } from '@tabler/icons-react'
import { isAllowedUri } from '@tiptap/extension-link'
import type { Editor } from '@tiptap/react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

// 链接操作 hook，参考 tiptap 官方 LinkPopover 的 useLinkHandler
function useLinkPopover(editor: Editor | null) {
  const [url, setUrl] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isActive, setIsActive] = useState(false)
  // 是否由用户主动点击按钮打开（区别于 autoOpen）
  const [manualOpen, setManualOpen] = useState(false)
  // 操作后短暂忽略 selectionUpdate，防止 popover 被重新打开
  const suppressUntilRef = useRef(0)

  // 监听选区变化，同步链接 URL 并自动打开/关闭 popover
  useEffect(() => {
    if (!editor) return

    const onSelectionUpdate = () => {
      if (Date.now() < suppressUntilRef.current) return

      const active = editor.isActive('link')
      setIsActive(active)
      if (active) {
        const { href } = editor.getAttributes('link')
        setUrl(href || '')
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
    const { href } = editor.getAttributes('link')
    setUrl(href || '')
    setIsActive(editor.isActive('link'))
    setIsOpen(true)
    setManualOpen(true)
  }, [editor])

  const closePopover = useCallback(() => {
    setIsOpen(false)
    setManualOpen(false)
  }, [])

  const setLink = useCallback(() => {
    if (!editor) return
    suppressUntilRef.current = Date.now() + 100
    // URL 为空时移除链接
    if (!url) {
      if (editor.isActive('link')) {
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .unsetLink()
          .setMeta('preventAutolink', true)
          .run()
      }
      setIsOpen(false)
      setIsActive(false)
      setManualOpen(false)
      return
    }
    let chain = editor.chain().focus().extendMarkRange('link').setLink({ href: url })
    // 空选区时插入 URL 文本
    if (editor.state.selection.empty) {
      chain = chain.insertContent({ type: 'text', text: url })
    }
    chain.run()
    setIsOpen(false)
    setManualOpen(false)
  }, [editor, url])

  const removeLink = useCallback(() => {
    if (!editor) return
    suppressUntilRef.current = Date.now() + 100
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .unsetLink()
      .setMeta('preventAutolink', true)
      .run()
    setUrl('')
    setIsOpen(false)
    setIsActive(false)
    setManualOpen(false)
  }, [editor])

  // 打开链接前校验 URI 白名单，防止 javascript:/data: 等危险 scheme
  const openLink = useCallback(() => {
    if (!editor) return
    const { href } = editor.getAttributes('link')
    if (!href || !isAllowedUri(href)) return
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [editor])

  return {
    url,
    setUrl,
    isOpen,
    isActive,
    manualOpen,
    openPopover,
    closePopover,
    setLink,
    removeLink,
    openLink,
  }
}

// 链接 Popover 组件，参考 tiptap 官方 LinkPopover 的 UX 模式
export default function LinkPopoverControl({ editor }: { editor: Editor | null }) {
  const t = useTranslations('admin.editor.linkPopover')
  const controlRef = useRef<HTMLButtonElement | null>(null)
  const [tooltipOpened, setTooltipOpened] = useState(false)
  const {
    url,
    setUrl,
    isOpen,
    isActive,
    manualOpen,
    openPopover,
    closePopover,
    setLink,
    removeLink,
    openLink,
  } = useLinkPopover(editor)

  const handleClick = useCallback(() => {
    setTooltipOpened(false)
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
      // 仅在用户主动点击按钮打开时捕获焦点，autoOpen 时不抢焦点
      trapFocus={manualOpen}
      shadow="md"
      withinPortal
      zIndex={10000}
      position="bottom"
    >
      <Tooltip
        label={t('insertLink')}
        position="bottom"
        withArrow
        withinPortal
        target={controlRef}
        opened={tooltipOpened && !isOpen}
      />
      <Popover.Target>
        <RichTextEditor.Control
          ref={controlRef}
          onClick={handleClick}
          onMouseEnter={() => setTooltipOpened(true)}
          onMouseLeave={() => setTooltipOpened(false)}
          onFocus={() => setTooltipOpened(true)}
          onBlur={() => setTooltipOpened(false)}
          active={isOpen || isActive}
          aria-label={t('insertLink')}
        >
          <IconLink size={16} />
        </RichTextEditor.Control>
      </Popover.Target>
      <Popover.Dropdown style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 360, alignItems: 'center' }}>
          <TextInput
            placeholder={t('placeholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setLink()
              }
              if (e.key === 'Escape') {
                closePopover()
              }
            }}
            style={{ flex: 1 }}
            size="sm"
            rightSection={
              <Tooltip label={t('apply')} withArrow zIndex={10001}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={setLink}
                  disabled={!url && !isActive}
                >
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

          <Tooltip label={t('openInNewTab')} withArrow zIndex={10001}>
            <ActionIcon variant="subtle" size="sm" onClick={openLink} disabled={!isActive}>
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t('remove')} withArrow zIndex={10001}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={removeLink}
              disabled={!isActive}
            >
              <IconLinkOff size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}
