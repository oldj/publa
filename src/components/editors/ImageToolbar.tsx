import { notify } from '@/lib/notify'
import { Button, Text, TextInput, Tooltip } from '@mantine/core'
import { useTranslations } from 'next-intl'
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowsMaximize,
  IconLink,
  IconMath1Divide2,
  IconMaximizeOff,
  IconRuler,
} from '@tabler/icons-react'
import type { Editor } from '@tiptap/react'

interface ImageToolbarProps {
  editor: Editor
  imageToolbar: { top: number; left: number }
  selectedImgRef: React.RefObject<HTMLImageElement | null>
  customSizeOpen: boolean
  setCustomSizeOpen: (v: boolean) => void
  customWidth: string
  setCustomWidth: (v: string) => void
  customHeight: string
  setCustomHeight: (v: string) => void
}

export default function ImageToolbar({
  editor,
  imageToolbar,
  selectedImgRef,
  customSizeOpen,
  setCustomSizeOpen,
  customWidth,
  setCustomWidth,
  customHeight,
  setCustomHeight,
}: ImageToolbarProps) {
  const t = useTranslations('admin.editor.imageToolbar')
  return (
    <div
      style={{
        position: 'absolute',
        top: imageToolbar.top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* 自定义尺寸输入面板 */}
        {customSizeOpen && (
          <div
            className="image-bubble-menu"
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).tagName === 'INPUT') return
              e.preventDefault()
            }}
          >
            <Text size="xs" c="dimmed" style={{ userSelect: 'none' }}>
              {t('width')}
            </Text>
            <TextInput
              size="xs"
              value={customWidth}
              onChange={(e) => setCustomWidth(e.target.value)}
              placeholder="auto"
              styles={{
                input: { height: 22, minHeight: 22, fontSize: 12, width: 56 },
              }}
            />
            <Text size="xs" c="dimmed" style={{ userSelect: 'none' }}>
              {t('height')}
            </Text>
            <TextInput
              size="xs"
              value={customHeight}
              onChange={(e) => setCustomHeight(e.target.value)}
              placeholder="auto"
              styles={{
                input: { height: 22, minHeight: 22, fontSize: 12, width: 56 },
              }}
            />
            <Button
              size="compact-xs"
              onClick={() => {
                const imgEl = selectedImgRef.current
                if (!imgEl || !editor) return
                const parseVal = (v: string) => {
                  if (!v) return null
                  return /^\d+$/.test(v) ? parseInt(v) : v
                }
                const w = parseVal(customWidth)
                const h = parseVal(customHeight)
                editor
                  .chain()
                  .focus()
                  .updateAttributes('image', {
                    width: typeof w === 'number' ? w : null,
                    height: typeof h === 'number' ? h : null,
                  })
                  .run()
                imgEl.style.width = w ? (typeof w === 'number' ? `${w}px` : w) : ''
                imgEl.style.height = h ? (typeof h === 'number' ? `${h}px` : h) : ''
                const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                if (wrapper) {
                  wrapper.style.width = w ? (typeof w === 'number' ? `${w}px` : w) : ''
                  wrapper.style.height = h ? (typeof h === 'number' ? `${h}px` : h) : ''
                }
                setCustomSizeOpen(false)
              }}
            >
              {t('confirm')}
            </Button>
          </div>
        )}
        {/* 主工具栏 */}
        <div className="image-bubble-menu" onMouseDown={(e) => e.preventDefault()}>
          <Tooltip label={t('autoSize')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                const imgEl = selectedImgRef.current
                if (!imgEl) return
                editor
                  .chain()
                  .focus()
                  .updateAttributes('image', { width: null, height: null })
                  .run()
                imgEl.style.width = ''
                imgEl.style.height = ''
                const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                if (wrapper) {
                  wrapper.style.width = ''
                  wrapper.style.height = ''
                }
              }}
            >
              <IconMaximizeOff size={14} stroke={1.5} />
            </Button>
          </Tooltip>
          <Tooltip label={t('originalSize')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                const imgEl = selectedImgRef.current
                if (!imgEl) return
                const w = imgEl.naturalWidth
                if (!w) return
                editor.chain().focus().updateAttributes('image', { width: w, height: null }).run()
                imgEl.style.width = `${w}px`
                imgEl.style.height = ''
                const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                if (wrapper) {
                  wrapper.style.width = `${w}px`
                  wrapper.style.height = ''
                }
              }}
            >
              <IconArrowsMaximize size={14} stroke={1.5} />
            </Button>
          </Tooltip>
          <Tooltip label={t('halfSize')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                const imgEl = selectedImgRef.current
                if (!imgEl) return
                const w = Math.round(imgEl.naturalWidth / 2)
                if (!w) return
                editor.chain().focus().updateAttributes('image', { width: w, height: null }).run()
                imgEl.style.width = `${w}px`
                imgEl.style.height = ''
                const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                if (wrapper) {
                  wrapper.style.width = `${w}px`
                  wrapper.style.height = ''
                }
              }}
            >
              <IconMath1Divide2 size={14} stroke={1.5} />
            </Button>
          </Tooltip>
          <Tooltip label={t('customSize')} withArrow>
            <Button
              size="compact-xs"
              variant={customSizeOpen ? 'filled' : 'subtle'}
              onClick={() => {
                if (!customSizeOpen) {
                  const imgEl = selectedImgRef.current
                  setCustomWidth(imgEl?.style.width?.replace('px', '') || '')
                  setCustomHeight(imgEl?.style.height?.replace('px', '') || '')
                }
                setCustomSizeOpen(!customSizeOpen)
              }}
            >
              <IconRuler size={14} stroke={1.5} />
            </Button>
          </Tooltip>

          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: 'var(--mantine-color-gray-3)',
            }}
          />

          <Tooltip label={t('alignLeft')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                editor.chain().focus().updateAttributes('image', { align: null }).run()
                const imgEl = selectedImgRef.current
                if (imgEl) {
                  imgEl.removeAttribute('data-align')
                  const c = imgEl.closest('[data-resize-container]') as HTMLElement
                  if (c) c.style.justifyContent = ''
                }
              }}
            >
              <IconAlignLeft size={14} stroke={1.5} />
            </Button>
          </Tooltip>
          <Tooltip label={t('alignCenter')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                editor.chain().focus().updateAttributes('image', { align: 'center' }).run()
                const imgEl = selectedImgRef.current
                if (imgEl) {
                  imgEl.setAttribute('data-align', 'center')
                  const c = imgEl.closest('[data-resize-container]') as HTMLElement
                  if (c) c.style.justifyContent = 'center'
                }
              }}
            >
              <IconAlignCenter size={14} stroke={1.5} />
            </Button>
          </Tooltip>
          <Tooltip label={t('alignRight')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                editor.chain().focus().updateAttributes('image', { align: 'right' }).run()
                const imgEl = selectedImgRef.current
                if (imgEl) {
                  imgEl.setAttribute('data-align', 'right')
                  const c = imgEl.closest('[data-resize-container]') as HTMLElement
                  if (c) c.style.justifyContent = 'flex-end'
                }
              }}
            >
              <IconAlignRight size={14} stroke={1.5} />
            </Button>
          </Tooltip>

          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              background: 'var(--mantine-color-gray-3)',
            }}
          />

          <Tooltip label={t('copyLink')} withArrow>
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={() => {
                const src = editor.getAttributes('image').src
                if (src) {
                  navigator.clipboard.writeText(src)
                  notify({ color: 'green', message: t('copied') })
                }
              }}
            >
              <IconLink size={14} stroke={1.5} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
