'use client'

import myModal from '@/app/(admin)/_components/myModals'
import { Text } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import '@mantine/tiptap/styles.css'
import { IconMath, IconMathFunction, IconPhoto, IconTable } from '@tabler/icons-react'
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
import { Embed } from './embed/EmbedNode'
import EmbedPopoverControl from './embed/EmbedPopover'
import ImagePickerModal from './ImagePickerModal'
import ImageToolbar from './ImageToolbar'
import LinkPopoverControl from './LinkPopover'
import MathModal from './MathModal'
import TableToolbar from './TableToolbar'
import './editor.scss'

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
  placeholder,
  onUpdate,
  onReady,
  onImageUpload,
  checkStorageConfig,
  editorRef,
  hidden,
}: RichTextEditorWrapperProps) {
  const t = useTranslations('admin.editor.richTextEditor')
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
              const node = schema.nodes.image.create({ src: url })
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

  // 从图片选择器插入多张图片（单个事务，一次 undo 可撤销）
  const handleImageInsert = useCallback(
    (urls: string[]) => {
      if (!editor || urls.length === 0) return
      // 使用打开 Modal 时保存的光标位置，无则插入到文档末尾
      const pos = imageInsertPosRef.current ?? editor.state.doc.content.size
      const content = urls.map((url) => ({ type: 'image', attrs: { src: url } }))
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
        style={{ position: 'relative', display: hidden ? 'none' : undefined }}
      >
        <Text size="sm" fw={500} mb={4}>
          {t('label')}
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
                title={t('insertTable')}
                disabled={editor?.isActive('table')}
              >
                <IconTable size={16} />
              </RichTextEditor.Control>
              <LinkPopoverControl editor={editor} />
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
                title={t('insertImage')}
              >
                <IconPhoto size={16} />
              </RichTextEditor.Control>
              <EmbedPopoverControl editor={editor} />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => {
                  mathEditPos.current = null
                  mathEditType.current = 'inlineMath'
                  setMathLatex('')
                  setMathModalOpen(true)
                }}
                title={t('inlineMath')}
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
                title={t('blockMath')}
              >
                <IconMathFunction size={16} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
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
