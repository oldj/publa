'use client'

import {
  type ContentType,
  htmlToMarkdown,
  renderMarkdownToHtml,
} from '@/components/editors/content-convert'
import ContentTypeSelector from '@/components/editors/ContentTypeSelector'
import RichTextEditorWrapper, {
  type RichTextEditorHandle,
} from '@/components/editors/RichTextEditorWrapper'
import myModal from '@/components/myModals'
import { notify } from '@/lib/notify'
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { IconArrowLeft, IconDeviceFloppy, IconSend } from '@tabler/icons-react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import RevisionHistory from '../../posts/_components/RevisionHistory'

const RESERVED_PATHS = ['admin', 'api', 'setup', 'rss.xml', 'sitemap.xml', 'uploads']

function validatePath(path: string): string | null {
  if (!path) return '路径不能为空'
  if (path.startsWith('/')) return '路径不能以 / 开头'
  if (path.endsWith('/')) return '路径不能以 / 结尾'
  const top = path.split('/')[0]
  if (RESERVED_PATHS.includes(top)) return `"${top}" 是保留路径，不能使用`
  return null
}

export default function PageEditor({ pageId }: { pageId?: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const lastAutoSaveContent = useRef<string>('')
  const [contentType, setContentType] = useState<ContentType>('richtext')
  const contentTypeRef = useRef<ContentType>('richtext')
  const [textContent, setTextContent] = useState('')
  const textContentRef = useRef('')
  const richTextRef = useRef<RichTextEditorHandle>(null)
  // 编辑器就绪前暂存待加载的 HTML 内容
  const pendingEditorContent = useRef<string | null>(null)
  const formRef = useRef<{ title: string }>({ title: '' })
  const [form, setForm] = useState({
    title: '',
    path: '',
    template: 'default',
    status: 'draft',
    seoTitle: '',
    seoDescription: '',
  })

  // 图片上传
  const storageConfigured = useRef<boolean | null>(null)
  const checkStorageConfig = useCallback(async () => {
    if (storageConfigured.current !== null) return storageConfigured.current
    try {
      const res = await fetch('/api/attachments/config')
      const json = await res.json()
      const configured =
        !!json.data?.storageProvider && ['s3', 'cos'].includes(json.data.storageProvider)
      storageConfigured.current = configured
      return configured
    } catch {
      return false
    }
  }, [])

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/attachments', { method: 'POST', body: formData })
    const json = await res.json()
    if (!json.success) throw new Error(json.message || '上传失败')
    return json.data.publicUrl
  }, [])

  // 加载页面数据（编辑模式）
  useEffect(() => {
    if (!pageId) return
    fetch(`/api/pages/${pageId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const p = json.data
          const draft = p.draftContent
          const contentRaw = draft ? draft.contentRaw : p.contentRaw
          const contentHtml = draft ? draft.contentHtml : p.contentHtml

          setForm({
            title: draft?.title || p.title,
            path: p.path,
            template: p.template,
            status: p.status,
            seoTitle: p.seoTitle || '',
            seoDescription: p.seoDescription || '',
          })

          const ct = (draft?.contentType || p.contentType || 'richtext') as ContentType
          setContentType(ct)
          contentTypeRef.current = ct

          if (ct === 'richtext' && contentHtml) {
            const ed = richTextRef.current?.getEditor()
            if (ed) {
              ed.commands.setContent(contentHtml)
            } else {
              // 编辑器还未就绪，暂存内容待 onReady 回调时设置
              pendingEditorContent.current = contentHtml
            }
          }

          setTextContent(contentRaw)
          textContentRef.current = contentRaw
          lastAutoSaveContent.current = contentRaw
          if (draft) {
            setAutoSaveTime(draft.updatedAt)
          }
        }
      })
  }, [pageId])

  // 同步 ref
  useEffect(() => {
    formRef.current = { title: form.title }
  }, [form.title])
  useEffect(() => {
    textContentRef.current = textContent
  }, [textContent])
  useEffect(() => {
    contentTypeRef.current = contentType
  }, [contentType])

  // 自动保存定时器（仅编辑模式）
  useEffect(() => {
    if (!pageId) return

    const timer = setInterval(() => {
      const ct = contentTypeRef.current
      const ed = richTextRef.current?.getEditor()
      const currentContent = ct === 'richtext' ? ed?.getHTML() || '' : textContentRef.current
      if (!currentContent || currentContent === lastAutoSaveContent.current) return

      let contentRaw = currentContent
      let contentHtml = ''

      if (ct === 'richtext' || ct === 'html') {
        contentHtml = currentContent
      }

      fetch(`/api/pages/${pageId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formRef.current.title,
          contentRaw,
          contentHtml,
          contentType: ct,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            lastAutoSaveContent.current = currentContent
            setAutoSaveTime(json.data.updatedAt)
          }
        })
        .catch(() => {})
    }, 5000)

    return () => clearInterval(timer)
  }, [pageId])

  const handlePathChange = (value: string) => {
    setForm((prev) => ({ ...prev, path: value }))
    setPathError(validatePath(value))
  }

  /** 提取当前编辑器内容 */
  const getContent = () => {
    let contentRaw = ''
    let contentHtml = ''
    const ed = richTextRef.current?.getEditor()

    if (contentType === 'richtext' && ed) {
      contentHtml = ed.getHTML()
      contentRaw = contentHtml
    } else if (contentType === 'html') {
      contentRaw = textContent
      contentHtml = textContent
    } else {
      contentRaw = textContent
    }

    return { contentRaw, contentHtml }
  }

  const handleSave = async (status?: string) => {
    if (!form.title) {
      notify({ color: 'red', message: '标题不能为空' })
      return
    }
    const err = validatePath(form.path)
    if (err) {
      setPathError(err)
      notify({ color: 'red', message: err })
      return
    }

    const { contentRaw, contentHtml } = getContent()

    setLoading(true)
    try {
      const url = pageId ? `/api/pages/${pageId}` : '/api/pages'
      const method = pageId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contentType,
          contentRaw,
          contentHtml,
          status: status || form.status,
        }),
      })
      const json = await res.json()
      if (json.success) {
        if (!pageId) {
          notify({ color: 'green', message: '创建成功' })
          router.push(`/admin/pages/${json.data.id}`)
        } else {
          const newStatus = status || form.status
          setForm((prev) => ({ ...prev, status: newStatus }))
          let msg = '保存成功'
          if (status === 'published') msg = '发布成功'
          else if (status === 'draft' && form.status !== 'draft') msg = '已转为草稿'
          notify({ color: 'green', message: msg })
          lastAutoSaveContent.current = contentRaw
          setAutoSaveTime(null)
        }
      } else {
        notify({ color: 'red', message: json.message || '操作失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleContentTypeChange = async (newType: ContentType) => {
    if (newType === contentType) return
    const warning = '切换内容类型可能导致格式或数据丢失，确定要切换吗？'
    if (!(await myModal.confirm({ message: warning }))) return

    const ed = richTextRef.current?.getEditor()

    // 从当前类型导出 HTML
    let currentHtml = ''
    if (contentType === 'richtext') {
      currentHtml = ed?.getHTML() || ''
    } else if (contentType === 'markdown') {
      currentHtml = await renderMarkdownToHtml(textContent)
    } else {
      currentHtml = textContent
    }

    // 转换到目标类型
    if (newType === 'richtext') {
      ed?.commands.setContent(currentHtml)
    } else if (newType === 'markdown') {
      const md = contentType === 'markdown' ? textContent : htmlToMarkdown(currentHtml)
      setTextContent(md)
      textContentRef.current = md
    } else {
      const html = contentType === 'html' ? textContent : currentHtml
      setTextContent(html)
      textContentRef.current = html
    }

    setContentType(newType)
    contentTypeRef.current = newType
  }

  const isEdit = !!pageId

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Group>
          <Button
            variant="subtle"
            component={Link}
            href="/admin/pages"
            leftSection={<IconArrowLeft size={16} />}
          >
            返回
          </Button>
          <Title order={3}>{isEdit ? '编辑页面' : '新建页面'}</Title>
          {isEdit && (
            <Badge color={form.status === 'published' ? 'green' : 'gray'} variant="light" size="lg">
              {form.status === 'published' ? '已发布' : '草稿'}
            </Badge>
          )}
          {autoSaveTime && (
            <Text size="sm" c="dimmed">
              自动保存：{dayjs(autoSaveTime).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          )}
        </Group>
        <Group>
          {isEdit && (
            <Button variant="subtle" onClick={() => setHistoryOpen(true)}>
              历史版本
            </Button>
          )}
          {isEdit && form.status === 'published' ? (
            <>
              <Button variant="default" onClick={() => handleSave('draft')} loading={loading}>
                转为草稿（下线）
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={() => handleSave('published')}
                loading={loading}
              >
                保存并发布
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={() => handleSave(isEdit ? undefined : 'draft')}
                loading={loading}
              >
                {isEdit ? '保存' : '保存草稿'}
              </Button>
              <Button
                leftSection={<IconSend size={16} />}
                onClick={() => handleSave('published')}
                loading={loading}
              >
                发布
              </Button>
            </>
          )}
        </Group>
      </Group>

      <Stack>
        <TextInput
          label="标题"
          required
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
        />
        <TextInput
          label="路径"
          required
          placeholder={isEdit ? undefined : 'about'}
          value={form.path}
          onChange={(e) => handlePathChange(e.target.value)}
          error={pathError}
        />
        <Group>
          <ContentTypeSelector value={contentType} onChange={handleContentTypeChange} />
          <Select
            label="模板"
            data={[
              { value: 'default', label: '默认（含头尾）' },
              { value: 'blank', label: '空白' },
            ]}
            value={form.template}
            onChange={(v) => setForm((prev) => ({ ...prev, template: v || 'default' }))}
          />
        </Group>

        {/* 富文本编辑器 */}
        <RichTextEditorWrapper
          editorRef={richTextRef}
          placeholder="开始撰写页面内容..."
          onImageUpload={uploadImage}
          checkStorageConfig={checkStorageConfig}
          onReady={(editor) => {
            if (pendingEditorContent.current) {
              editor.commands.setContent(pendingEditorContent.current)
              pendingEditorContent.current = null
            }
          }}
          hidden={contentType !== 'richtext'}
        />

        {/* Markdown / HTML 文本编辑器 */}
        {contentType !== 'richtext' && (
          <Textarea
            label={contentType === 'markdown' ? 'Markdown 内容' : 'HTML 内容'}
            placeholder={contentType === 'markdown' ? '在此输入 Markdown...' : '在此输入 HTML...'}
            autosize
            minRows={15}
            value={textContent}
            onChange={(e) => {
              setTextContent(e.target.value)
              textContentRef.current = e.target.value
            }}
            styles={{ input: { fontFamily: 'monospace', maxHeight: 600, overflowY: 'auto' } }}
          />
        )}

        <TextInput
          label="SEO 标题"
          value={form.seoTitle}
          onChange={(e) => setForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
        />
        <TextInput
          label="SEO 描述"
          value={form.seoDescription}
          onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
        />
      </Stack>

      {/* 历史版本 */}
      {pageId && (
        <RevisionHistory
          targetType="page"
          targetId={pageId}
          opened={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={() => window.location.reload()}
        />
      )}
    </div>
  )
}
