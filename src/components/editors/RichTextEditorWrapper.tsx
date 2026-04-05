'use client'

import myModal from '@/components/myModals'
import { codeHighlightAliases, codeHighlightLanguages } from '@/lib/code-highlight'
import { notify } from '@/lib/notify'
import { Button, Group, Modal, Stack, Text, TextInput, Textarea, Tooltip } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import '@mantine/tiptap/styles.css'
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowsMaximize,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconLink,
  IconMath,
  IconMath1Divide2,
  IconMathFunction,
  IconMaximizeOff,
  IconPhoto,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconRuler,
  IconTable,
  IconTableOff,
} from '@tabler/icons-react'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TiptapImage from '@tiptap/extension-image'
import Mathematics from '@tiptap/extension-mathematics'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import type { Editor } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import 'katex/dist/katex.min.css'
import { createLowlight } from 'lowlight'
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './editor.scss'

// 代码高亮初始化
const lowlight = createLowlight()
lowlight.register(codeHighlightLanguages)
lowlight.registerAlias(codeHighlightAliases)
const languages = lowlight.listLanguages()

// 代码块自定义组件，左上角显示语言选择器
function CodeBlockView({ node, updateAttributes }: any) {
  return (
    <NodeViewWrapper style={{ position: 'relative' }}>
      <select
        contentEditable={false}
        value={node.attrs.language || ''}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          zIndex: 1,
          fontSize: 12,
          padding: '2px 4px',
          borderRadius: 4,
          border: '1px solid #ddd',
          background: '#f5f5f5',
          color: '#555',
          cursor: 'pointer',
        }}
      >
        <option value="">auto</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
      <pre>
        <NodeViewContent as={'code' as any} />
      </pre>
    </NodeViewWrapper>
  )
}

export interface RichTextEditorHandle {
  getEditor: () => Editor | null
}

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
}

export default function RichTextEditorWrapper({
  initialContent,
  placeholder = '开始撰写内容...',
  onUpdate,
  onReady,
  onImageUpload,
  checkStorageConfig,
  editorRef,
  hidden,
}: RichTextEditorWrapperProps) {
  // 浮动工具栏
  const [imageToolbar, setImageToolbar] = useState<{ top: number; left: number } | null>(null)
  const [tableToolbar, setTableToolbar] = useState<{ top: number } | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const selectedImgRef = useRef<HTMLImageElement | null>(null)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')

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
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
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
              default: null,
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
          const style =
            align === 'center'
              ? 'display:block;margin-left:auto;margin-right:auto'
              : align === 'right'
                ? 'display:block;margin-left:auto'
                : undefined
          return [
            'img',
            { ...rest, ...(align ? { 'data-align': align } : {}), ...(style ? { style } : {}) },
          ]
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
      Placeholder.configure({ placeholder }),
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
              const node = schema.nodes.image.create({ src: url })
              const insertTr = view.state.tr.replaceSelectionWith(node)
              view.dispatch(insertTr)
            })
            .catch((err) => {
              myModal.alert({ message: `图片上传失败: ${err.message}` })
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
        style={{ position: 'relative', display: hidden ? 'none' : undefined }}
      >
        <Text size="sm" fw={500} mb={4}>
          内容
        </Text>
        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.Code />
              <RichTextEditor.ClearFormatting />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H1 />
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
              <RichTextEditor.H4 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.Hr />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
              <RichTextEditor.CodeBlock />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => {
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }}
                title="插入表格"
                disabled={editor?.isActive('table')}
              >
                <IconTable size={16} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={async () => {
                  const configured = await checkStorageConfig()
                  if (!configured) {
                    await myModal.alert({
                      message: '请先在附件管理中配置存储服务后再上传图片。',
                    })
                    return
                  }
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = async () => {
                    const file = input.files?.[0]
                    if (!file) return
                    try {
                      const url = await onImageUpload(file)
                      editor?.chain().focus().setImage({ src: url }).run()
                    } catch (err: any) {
                      await myModal.alert({ message: `图片上传失败: ${err.message}` })
                    }
                  }
                  input.click()
                }}
                title="插入图片"
              >
                <IconPhoto size={16} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => {
                  mathEditPos.current = null
                  mathEditType.current = 'inlineMath'
                  setMathLatex('')
                  setMathModalOpen(true)
                }}
                title="行内公式"
              >
                <IconMath size={16} />
              </RichTextEditor.Control>
              <RichTextEditor.Control
                onClick={() => {
                  mathEditPos.current = null
                  mathEditType.current = 'blockMath'
                  setMathLatex('')
                  setMathModalOpen(true)
                }}
                title="公式块"
              >
                <IconMathFunction size={16} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>

          <RichTextEditor.Content />
        </RichTextEditor>

        {/* 图片浮动工具栏 */}
        {imageToolbar && editor && (
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
                    宽
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
                    高
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
                    确认
                  </Button>
                </div>
              )}
              {/* 主工具栏 */}
              <div className="image-bubble-menu" onMouseDown={(e) => e.preventDefault()}>
                <Tooltip label="自动尺寸" withArrow>
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
                    <IconMaximizeOff size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="原始尺寸" withArrow>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => {
                      const imgEl = selectedImgRef.current
                      if (!imgEl) return
                      const w = imgEl.naturalWidth
                      if (!w) return
                      editor
                        .chain()
                        .focus()
                        .updateAttributes('image', { width: w, height: null })
                        .run()
                      imgEl.style.width = `${w}px`
                      imgEl.style.height = ''
                      const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                      if (wrapper) {
                        wrapper.style.width = `${w}px`
                        wrapper.style.height = ''
                      }
                    }}
                  >
                    <IconArrowsMaximize size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="1/2 尺寸" withArrow>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => {
                      const imgEl = selectedImgRef.current
                      if (!imgEl) return
                      const w = Math.round(imgEl.naturalWidth / 2)
                      if (!w) return
                      editor
                        .chain()
                        .focus()
                        .updateAttributes('image', { width: w, height: null })
                        .run()
                      imgEl.style.width = `${w}px`
                      imgEl.style.height = ''
                      const wrapper = imgEl.closest('[data-node-view-wrapper]') as HTMLElement
                      if (wrapper) {
                        wrapper.style.width = `${w}px`
                        wrapper.style.height = ''
                      }
                    }}
                  >
                    <IconMath1Divide2 size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="自定义尺寸" withArrow>
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
                    <IconRuler size={14} />
                  </Button>
                </Tooltip>

                <div
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    background: 'var(--mantine-color-gray-3)',
                  }}
                />

                <Tooltip label="居左" withArrow>
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
                    <IconAlignLeft size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="居中" withArrow>
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
                    <IconAlignCenter size={14} />
                  </Button>
                </Tooltip>
                <Tooltip label="居右" withArrow>
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
                    <IconAlignRight size={14} />
                  </Button>
                </Tooltip>

                <div
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    background: 'var(--mantine-color-gray-3)',
                  }}
                />

                <Tooltip label="复制图片链接" withArrow>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => {
                      const src = editor.getAttributes('image').src
                      if (src) {
                        navigator.clipboard.writeText(src)
                        notify({ color: 'green', message: '已复制链接' })
                      }
                    }}
                  >
                    <IconLink size={14} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        {/* 表格浮动工具栏 */}
        {tableToolbar && editor && (
          <div
            style={{
              position: 'absolute',
              top: tableToolbar.top,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <div className="image-bubble-menu" style={{ pointerEvents: 'auto' }}>
              <Tooltip label="前方插入列" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => editor.chain().focus().addColumnBefore().run()}
                >
                  <IconColumnInsertLeft size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="后方插入列" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                >
                  <IconColumnInsertRight size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="删除列" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                >
                  <IconColumnRemove size={16} />
                </Button>
              </Tooltip>

              <div style={{ width: 1, height: 16, background: 'var(--mantine-color-gray-3)' }} />

              <Tooltip label="上方插入行" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => editor.chain().focus().addRowBefore().run()}
                >
                  <IconRowInsertTop size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="下方插入行" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                >
                  <IconRowInsertBottom size={16} />
                </Button>
              </Tooltip>
              <Tooltip label="删除行" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                >
                  <IconRowRemove size={16} />
                </Button>
              </Tooltip>

              <div style={{ width: 1, height: 16, background: 'var(--mantine-color-gray-3)' }} />

              <Tooltip label="删除表格" position="top" withArrow>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  <IconTableOff size={16} />
                </Button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* 公式编辑弹窗 */}
      <Modal
        opened={mathModalOpen}
        onClose={() => setMathModalOpen(false)}
        title={mathEditType.current === 'inlineMath' ? '编辑行内公式' : '编辑公式块'}
        size="lg"
        centered
      >
        <Stack>
          {mathEditType.current === 'blockMath' ? (
            <Textarea
              label="LaTeX"
              placeholder="输入 LaTeX 公式，如 \int_0^\infty x^2 dx"
              autosize
              minRows={3}
              value={mathLatex}
              onChange={(e) => setMathLatex(e.target.value)}
              styles={{ input: { fontFamily: 'monospace' } }}
              data-autofocus
            />
          ) : (
            <TextInput
              label="LaTeX"
              placeholder="输入 LaTeX 公式，如 E=mc^2"
              value={mathLatex}
              onChange={(e) => setMathLatex(e.target.value)}
              styles={{ input: { fontFamily: 'monospace' } }}
              data-autofocus
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setMathModalOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!editor || !mathLatex.trim()) return
                const type = mathEditType.current
                const pos = mathEditPos.current

                if (pos !== null) {
                  const node = editor.state.doc.nodeAt(pos)
                  if (node) {
                    editor
                      .chain()
                      .focus()
                      .command(({ tr }) => {
                        tr.replaceWith(
                          pos,
                          pos + node.nodeSize,
                          editor.schema.nodes[type].create({ latex: mathLatex.trim() }),
                        )
                        return true
                      })
                      .run()
                  }
                } else {
                  editor
                    .chain()
                    .focus()
                    .insertContent({ type, attrs: { latex: mathLatex.trim() } })
                    .run()
                }

                setMathModalOpen(false)
              }}
            >
              确定
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
