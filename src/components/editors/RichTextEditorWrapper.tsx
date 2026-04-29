'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { Loader, Text, Tooltip } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import '@mantine/tiptap/styles.css'
import {
  IconArticle,
  IconDeviceFloppy,
  IconMath,
  IconMathFunction,
  IconMaximize,
  IconMinimize,
  IconPhoto,
  IconTable,
} from '@tabler/icons-react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TiptapImage from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Mathematics from '@tiptap/extension-mathematics'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/react'
import { ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import 'katex/dist/katex.min.css'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import CodeBlockView, { lowlight } from './CodeBlockView'
import './editor.scss'
import { Embed } from './embed/EmbedNode'
import EmbedPopoverControl from './embed/EmbedPopover'
import ImagePickerModal from './ImagePickerModal'
import ImageToolbar from './ImageToolbar'
import LinkPopoverControl from './LinkPopover'
import MathModal from './MathModal'
import TableToolbar from './TableToolbar'

export interface RichTextEditorHandle {
  getEditor: () => Editor | null
}

// 工具栏统一的 Tooltip 包装：position=bottom + 箭头 + portal
// 避免最大化时按钮顶部紧贴视口顶端被切，且不受任何父容器 overflow / stacking 干扰
function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip label={label} position="bottom" withArrow withinPortal>
      {children}
    </Tooltip>
  )
}

// 用户主动点击「最小化」后写入这条记录，下次进入最大化就不再自动弹出引导提示
const MAXIMIZE_HINT_STORAGE_KEY = 'publa.editor.maximizeHintSeen'
const MAXIMIZE_HINT_DURATION_MS = 5000
// 最大化时的「限宽阅读」开关持久化
const NARROW_MODE_STORAGE_KEY = 'publa.editor.narrowMode'
// 视口宽度大于此值才显示限宽切换按钮（窄屏视口本身就不需要限宽）
const NARROW_MODE_MIN_VIEWPORT_PX = 720

interface RichTextEditorWrapperProps {
  initialContent?: string
  placeholder?: string
  onUpdate?: () => void
  /** 编辑器实例就绪时回调，可用于延迟设置内容 */
  onReady?: (editor: Editor) => void
  onImageUpload: (file: File) => Promise<string>
  checkStorageConfig: () => Promise<boolean>
  editorRef?: React.Ref<RichTextEditorHandle>
  /** 通过 display:none 隐藏而非卸载 */
  hidden?: boolean
  /** 最大化时显示保存按钮，等同于页面右上角的"保存草稿" */
  onSave?: () => void | Promise<void>
  /** 保存按钮的 loading 状态 */
  saveLoading?: boolean
}

export default function RichTextEditorWrapper({
  initialContent,
  placeholder,
  onUpdate,
  onReady,
  onImageUpload,
  checkStorageConfig,
  editorRef,
  hidden,
  onSave,
  saveLoading,
}: RichTextEditorWrapperProps) {
  const t = useTranslations('admin.editor.richTextEditor')
  const tCommon = useTranslations('common')
  const effectivePlaceholder = placeholder || t('placeholder')
  // 浮动工具栏
  const [imageToolbar, setImageToolbar] = useState<{ top: number; left: number } | null>(null)
  const [tableToolbar, setTableToolbar] = useState<{ top: number } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const selectedImgRef = useRef<HTMLImageElement | null>(null)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')

  // 图片选择器状态
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const imageInsertPosRef = useRef<number | null>(null)

  // 最大化状态
  const [isMaximized, setIsMaximized] = useState(false)

  // 限宽阅读开关：从 localStorage 恢复用户偏好
  const [narrowMode, setNarrowMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NARROW_MODE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  // 视口宽度是否够大（达不到时隐藏限宽切换按钮，但保留 narrowMode state）
  // lazy init：客户端首次渲染就给出准确值，避免一次无谓的 setState 重渲染
  const [isWideScreen, setIsWideScreen] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(min-width: ${NARROW_MODE_MIN_VIEWPORT_PX}px)`).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${NARROW_MODE_MIN_VIEWPORT_PX}px)`)
    const handler = () => setIsWideScreen(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // 最大化按钮的 Tooltip：进入最大化时自动弹出 3 秒；hover 暂停倒计时
  const [maximizeTipOpen, setMaximizeTipOpen] = useState(false)
  const tipHoverRef = useRef(false)
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTipTimer = () => {
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current)
      tipTimerRef.current = null
    }
  }
  const startTipAutoHide = () => {
    clearTipTimer()
    tipTimerRef.current = setTimeout(() => {
      if (!tipHoverRef.current) setMaximizeTipOpen(false)
      tipTimerRef.current = null
    }, MAXIMIZE_HINT_DURATION_MS)
  }

  // 公式编辑状态
  const [mathModalOpen, setMathModalOpen] = useState(false)
  const [mathLatex, setMathLatex] = useState('')
  const mathEditPos = useRef<number | null>(null)
  const mathEditType = useRef<'inlineMath' | 'blockMath'>('inlineMath')

  const openMathEditor = useCallback((node: any, pos: number) => {
    mathEditPos.current = pos
    mathEditType.current = node.type.name as 'inlineMath' | 'blockMath'
    setMathLatex(node.attrs.latex || '')
    setMathModalOpen(true)
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap v3 把默认行为从「每次 transaction 都 rerender」改为「不 rerender」（性能优化）。
    // 但 Mantine RichTextEditor 工具栏的 active 高亮（加粗 / H1 等）靠组件 rerender 后重新读
    // editor.isActive(...) 刷新；不开启此项时，光标移动后按钮状态不会更新，需要 hover 误触发
    // 才会刷新。开启后每次按键 / 选区变化都 rerender，工具栏正常响应。
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false }),
      Link.extend({ addPasteRules: () => [] }).configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView)
        },
      }).configure({ lowlight }),
      TiptapImage.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            align: {
              default: 'center',
              parseHTML: (element) => element.getAttribute('data-align'),
              renderHTML: (attributes) => {
                if (!attributes.align) return {}
                return { 'data-align': attributes.align }
              },
            },
          }
        },
        renderHTML({ HTMLAttributes }) {
          const { align, ...rest } = HTMLAttributes
          return ['img', { ...rest, ...(align ? { 'data-align': align } : {}) }]
        },
      }).configure({
        inline: false,
        resize: {
          enabled: true,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Mathematics.configure({
        inlineOptions: { onClick: openMathEditor },
        blockOptions: { onClick: openMathEditor },
      }),
      TableKit.configure({
        table: {
          resizable: true,
          lastColumnResizable: true,
          allowTableNodeSelection: true,
        },
      }),
      Placeholder.configure({ placeholder: effectivePlaceholder }),
      Embed,
    ],
    content: initialContent || '',
    editorProps: {
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || [])
        const images = files.filter((f) => f.type.startsWith('image/'))
        if (images.length === 0) return false

        event.preventDefault()
        for (const file of images) {
          onImageUpload(file)
            .then((url) => {
              const { schema } = view.state
              const node = schema.nodes.image.create({ src: url, align: 'center' })
              const insertTr = view.state.tr.replaceSelectionWith(node)
              view.dispatch(insertTr)
            })
            .catch((err) => {
              myModal.alert({ message: t('imageUploadFailed', { message: err.message }) })
            })
        }
        return true
      },
    },
    onUpdate: () => {
      onUpdate?.()
    },
  })

  // 暴露 editor 实例
  useImperativeHandle(editorRef, () => ({
    getEditor: () => editor,
  }))

  // 最大化时锁定页面滚动 + 给 body 加 data-rich-editor-maximized，配合 CSS 隐藏 AppShell 的 Navbar / Header；
  // 首次进入时弹出最大化按钮的 Tooltip 提示用户如何退出，到时自动收起
  useEffect(() => {
    if (!isMaximized) {
      clearTipTimer()
      setMaximizeTipOpen(false)
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.richEditorMaximized = 'true'
    // 用户已经点过最小化按钮，认为已经知道如何退出，跳过引导提示
    let hintSeen = false
    try {
      hintSeen = localStorage.getItem(MAXIMIZE_HINT_STORAGE_KEY) === '1'
    } catch {
      // localStorage 不可用（隐私模式等）时按未看过处理，正常引导
    }
    // 等到最大化的样式应用、布局稳定（fixed inset:0 应用后）再开 Tooltip，
    // 否则 Mantine Tooltip 内部会用旧位置计算气泡坐标，导致看似没显示
    let rafId = 0
    if (!hintSeen) {
      rafId = requestAnimationFrame(() => {
        setMaximizeTipOpen(true)
        startTipAutoHide()
      })
    }
    return () => {
      document.body.style.overflow = prevOverflow
      delete document.body.dataset.richEditorMaximized
      if (rafId) cancelAnimationFrame(rafId)
      clearTipTimer()
    }
  }, [isMaximized])

  // 卸载时清理计时器
  useEffect(() => () => clearTipTimer(), [])

  // 从图片选择器插入多张图片（单个事务，一次 undo 可撤销）
  const handleImageInsert = useCallback(
    (urls: string[]) => {
      if (!editor || urls.length === 0) return
      // 使用打开 Modal 时保存的光标位置，无则插入到文档末尾
      const pos = imageInsertPosRef.current ?? editor.state.doc.content.size
      const content = urls.map((url) => ({ type: 'image', attrs: { src: url, align: 'center' } }))
      editor.chain().focus().insertContentAt(pos, content).run()
      imageInsertPosRef.current = null
      // Modal 关闭由 ImagePickerModal 的 handleInsert 调用 onClose 完成
    },
    [editor],
  )

  // 编辑器就绪时通知父组件
  const onReadyCalledRef = useRef(false)
  useEffect(() => {
    if (editor && onReady && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true
      onReady(editor)
    }
  }, [editor, onReady])

  // 监听编辑器选区变化，更新图片工具栏位置
  useEffect(() => {
    if (!editor) return

    const updateImageToolbar = () => {
      const container = editorContainerRef.current
      if (!editor.isActive('image') || !container) {
        setImageToolbar(null)
        selectedImgRef.current = null
        return
      }

      const pos = editor.state.selection.from
      const nodeDom = editor.view.nodeDOM(pos) as HTMLElement | null
      if (!nodeDom) {
        setImageToolbar(null)
        selectedImgRef.current = null
        return
      }

      const imgEl =
        nodeDom.tagName === 'IMG' ? (nodeDom as HTMLImageElement) : nodeDom.querySelector('img')
      if (!imgEl) {
        setImageToolbar(null)
        selectedImgRef.current = null
        return
      }

      selectedImgRef.current = imgEl

      container
        .querySelectorAll('.image-selected')
        .forEach((el) => el.classList.remove('image-selected'))
      nodeDom.classList.add('image-selected')

      const containerRect = container.getBoundingClientRect()
      const imgRect = imgEl.getBoundingClientRect()

      const toolbarHeight = 36
      const spaceAbove = imgRect.top - containerRect.top
      const top =
        spaceAbove >= toolbarHeight + 8
          ? imgRect.top - containerRect.top - toolbarHeight - 4
          : imgRect.bottom - containerRect.top + 4

      setImageToolbar({
        top,
        left: imgRect.left - containerRect.left + imgRect.width / 2,
      })
    }

    const clearImageSelection = () => {
      if (!editor.isActive('image')) {
        editorContainerRef.current
          ?.querySelectorAll('.image-selected')
          .forEach((el) => el.classList.remove('image-selected'))
      }
    }

    const syncImageAlign = () => {
      const imgs = editorContainerRef.current?.querySelectorAll('.ProseMirror img[data-align]')
      imgs?.forEach((img) => {
        const align = img.getAttribute('data-align')
        const resizeContainer = img.closest('[data-resize-container]') as HTMLElement
        if (!resizeContainer) return
        resizeContainer.style.justifyContent =
          align === 'center' ? 'center' : align === 'right' ? 'flex-end' : ''
      })
      const allContainers = editorContainerRef.current?.querySelectorAll('[data-resize-container]')
      allContainers?.forEach((c) => {
        const img = c.querySelector('img')
        if (img && !img.getAttribute('data-align')) {
          ;(c as HTMLElement).style.justifyContent = ''
        }
      })
    }

    const updateTableToolbar = () => {
      const container = editorContainerRef.current
      if (!editor.isActive('table') || !container) {
        setTableToolbar(null)
        return
      }

      // 从选区向上查找 table DOM 元素
      const { $from } = editor.state.selection
      let depth = $from.depth
      let tablePos = -1
      while (depth > 0) {
        if ($from.node(depth).type.name === 'table') {
          tablePos = $from.before(depth)
          break
        }
        depth--
      }
      if (tablePos < 0) {
        setTableToolbar(null)
        return
      }

      const tableDom = editor.view.nodeDOM(tablePos) as HTMLElement | null
      if (!tableDom) {
        setTableToolbar(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      const tableRect = tableDom.getBoundingClientRect()

      const toolbarHeight = 36
      const spaceAbove = tableRect.top - containerRect.top
      const top =
        spaceAbove >= toolbarHeight + 8
          ? tableRect.top - containerRect.top - toolbarHeight - 4
          : tableRect.bottom - containerRect.top + 4

      setTableToolbar({ top })
    }

    editor.on('selectionUpdate', updateImageToolbar)
    editor.on('selectionUpdate', clearImageSelection)
    editor.on('selectionUpdate', updateTableToolbar)
    editor.on('transaction', updateImageToolbar)
    editor.on('transaction', syncImageAlign)
    editor.on('transaction', updateTableToolbar)
    return () => {
      editor.off('selectionUpdate', updateImageToolbar)
      editor.off('selectionUpdate', clearImageSelection)
      editor.off('selectionUpdate', updateTableToolbar)
      editor.off('transaction', updateImageToolbar)
      editor.off('transaction', syncImageAlign)
      editor.off('transaction', updateTableToolbar)
    }
  }, [editor])

  return (
    <>
      <div
        ref={editorContainerRef}
        data-role="rich-text-editor-container"
        className={isMaximized ? 'rich-editor-maximized' : undefined}
        data-narrow-mode={isMaximized && narrowMode ? 'true' : undefined}
        style={{ position: 'relative', display: hidden ? 'none' : undefined }}
        onKeyDown={(e) => {
          // Cmd/Ctrl + S：触发保存（与右上角"保存"等价）；
          // 排除 Shift/Alt 组合，避免误捕获"另存为"等扩展快捷键
          if (!onSave) return
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyS') {
            e.preventDefault()
            if (!saveLoading) void onSave()
          }
        }}
      >
        {!isMaximized && (
          <Text size="sm" fw={500} mb={4}>
            {t('label')}
          </Text>
        )}
        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <Tip label={t('bold')}>
                <RichTextEditor.Bold />
              </Tip>
              <Tip label={t('italic')}>
                <RichTextEditor.Italic />
              </Tip>
              <Tip label={t('strikethrough')}>
                <RichTextEditor.Strikethrough />
              </Tip>
              <Tip label={t('code')}>
                <RichTextEditor.Code />
              </Tip>
              <Tip label={t('clearFormatting')}>
                <RichTextEditor.ClearFormatting />
              </Tip>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Tip label={t('h1')}>
                <RichTextEditor.H1 />
              </Tip>
              <Tip label={t('h2')}>
                <RichTextEditor.H2 />
              </Tip>
              <Tip label={t('h3')}>
                <RichTextEditor.H3 />
              </Tip>
              <Tip label={t('h4')}>
                <RichTextEditor.H4 />
              </Tip>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Tip label={t('blockquote')}>
                <RichTextEditor.Blockquote />
              </Tip>
              <Tip label={t('hr')}>
                <RichTextEditor.Hr />
              </Tip>
              <Tip label={t('bulletList')}>
                <RichTextEditor.BulletList />
              </Tip>
              <Tip label={t('orderedList')}>
                <RichTextEditor.OrderedList />
              </Tip>
              <Tip label={t('codeBlock')}>
                <RichTextEditor.CodeBlock />
              </Tip>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Tip label={t('insertTable')}>
                <RichTextEditor.Control
                  onClick={() => {
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }}
                  disabled={editor?.isActive('table')}
                  aria-label={t('insertTable')}
                >
                  <IconTable size={16} />
                </RichTextEditor.Control>
              </Tip>
              <LinkPopoverControl editor={editor} />
              <Tip label={t('insertImage')}>
                <RichTextEditor.Control
                  onClick={async () => {
                    const configured = await checkStorageConfig()
                    if (!configured) {
                      await myModal.alert({
                        message: t('storageNotConfigured'),
                      })
                      return
                    }
                    // 保存当前光标位置，Modal 打开后编辑器会失焦
                    imageInsertPosRef.current = editor?.state.selection.anchor ?? null
                    setImagePickerOpen(true)
                  }}
                  aria-label={t('insertImage')}
                >
                  <IconPhoto size={16} />
                </RichTextEditor.Control>
              </Tip>
              <EmbedPopoverControl editor={editor} />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Tip label={t('inlineMath')}>
                <RichTextEditor.Control
                  onClick={() => {
                    mathEditPos.current = null
                    mathEditType.current = 'inlineMath'
                    setMathLatex('')
                    setMathModalOpen(true)
                  }}
                  aria-label={t('inlineMath')}
                >
                  <IconMath size={16} />
                </RichTextEditor.Control>
              </Tip>
              <Tip label={t('blockMath')}>
                <RichTextEditor.Control
                  onClick={() => {
                    mathEditPos.current = null
                    mathEditType.current = 'blockMath'
                    setMathLatex('')
                    setMathModalOpen(true)
                  }}
                  aria-label={t('blockMath')}
                >
                  <IconMathFunction size={16} />
                </RichTextEditor.Control>
              </Tip>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <Tip label={t('undo')}>
                <RichTextEditor.Undo />
              </Tip>
              <Tip label={t('redo')}>
                <RichTextEditor.Redo />
              </Tip>
            </RichTextEditor.ControlsGroup>

            {/* 占位：把最大化按钮推到工具栏最右侧 */}
            <div style={{ flex: 1 }} />

            {isMaximized && isWideScreen && (
              <RichTextEditor.ControlsGroup>
                <Tip label={t('narrowMode')}>
                  <RichTextEditor.Control
                    onClick={() => {
                      setNarrowMode((v) => {
                        const next = !v
                        try {
                          localStorage.setItem(NARROW_MODE_STORAGE_KEY, next ? '1' : '0')
                        } catch {
                          // localStorage 不可用时静默忽略，state 仍然在内存中切换
                        }
                        return next
                      })
                    }}
                    active={narrowMode}
                    aria-label={t('narrowMode')}
                  >
                    <IconArticle size={16} />
                  </RichTextEditor.Control>
                </Tip>
              </RichTextEditor.ControlsGroup>
            )}

            {isMaximized && onSave && (
              <RichTextEditor.ControlsGroup>
                <Tip label={tCommon('actions.save')}>
                  <RichTextEditor.Control
                    onClick={() => {
                      void onSave()
                    }}
                    disabled={saveLoading}
                    aria-label={tCommon('actions.save')}
                  >
                    {saveLoading ? <Loader size={16} /> : <IconDeviceFloppy size={16} />}
                  </RichTextEditor.Control>
                </Tip>
              </RichTextEditor.ControlsGroup>
            )}

            <RichTextEditor.ControlsGroup>
              <Tooltip
                label={isMaximized ? t('exitMaximize') : t('maximize')}
                opened={maximizeTipOpen}
                position="bottom"
                withArrow
                withinPortal
                zIndex={500}
                events={{ hover: false, focus: false, touch: false }}
              >
                <span
                  onMouseEnter={() => {
                    tipHoverRef.current = true
                    clearTipTimer()
                    setMaximizeTipOpen(true)
                  }}
                  onMouseLeave={() => {
                    tipHoverRef.current = false
                    setMaximizeTipOpen(false)
                  }}
                  style={{ display: 'inline-flex' }}
                >
                  <RichTextEditor.Control
                    onClick={() => {
                      // 用户主动点最小化按钮 -> 已学会如何退出，下次不再自动弹出引导
                      if (isMaximized) {
                        try {
                          localStorage.setItem(MAXIMIZE_HINT_STORAGE_KEY, '1')
                        } catch {
                          // localStorage 不可用时静默忽略
                        }
                      }
                      setIsMaximized((v) => !v)
                    }}
                    aria-label={isMaximized ? t('exitMaximize') : t('maximize')}
                  >
                    {isMaximized ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
                  </RichTextEditor.Control>
                </span>
              </Tooltip>
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content data-role="rich-text-editor" />
        </RichTextEditor>

        {/* 图片浮动工具栏 */}
        {imageToolbar && editor && (
          <ImageToolbar
            editor={editor}
            imageToolbar={imageToolbar}
            selectedImgRef={selectedImgRef}
            customSizeOpen={customSizeOpen}
            setCustomSizeOpen={setCustomSizeOpen}
            customWidth={customWidth}
            setCustomWidth={setCustomWidth}
            customHeight={customHeight}
            setCustomHeight={setCustomHeight}
          />
        )}

        {/* 表格浮动工具栏 */}
        {tableToolbar && editor && <TableToolbar editor={editor} tableToolbar={tableToolbar} />}
      </div>

      {/* 公式编辑弹窗 */}
      <MathModal
        editor={editor}
        opened={mathModalOpen}
        onClose={() => setMathModalOpen(false)}
        mathLatex={mathLatex}
        setMathLatex={setMathLatex}
        mathEditType={mathEditType}
        mathEditPos={mathEditPos}
      />

      {/* 图片选择器弹窗 */}
      <ImagePickerModal
        opened={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onInsert={handleImageInsert}
      />
    </>
  )
}
