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
import { shouldCreateDraftRecord } from '../../_lib/draft-persistence'
import { buildPageDraftPayload, buildPageSaveBody } from './page-save-payload'
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

interface PageDraftContent {
  title: string
  path: string
  template: string
  seoTitle: string
  seoDescription: string
  contentType: ContentType
  contentRaw: string
  contentHtml: string
  updatedAt: string
}

export default function PageEditor({ pageId }: { pageId?: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const lastAutoSaveContent = useRef<string>('')
  const lastAutoSaveMetaRef = useRef<string>('')
  const creatingRef = useRef(false)
  const pendingCreatedPageIdRef = useRef<number | null>(null)
  const autoSavingRef = useRef(false)
  const [contentType, setContentType] = useState<ContentType>('richtext')
  const contentTypeRef = useRef<ContentType>('richtext')
  const [textContent, setTextContent] = useState('')
  const textContentRef = useRef('')
  const richTextRef = useRef<RichTextEditorHandle>(null)
  // 编辑器就绪前暂存待加载的 HTML 内容
  const pendingEditorContent = useRef<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    path: '',
    template: 'default',
    status: 'draft',
    seoTitle: '',
    seoDescription: '',
  })
  const formRef = useRef(form)

  // 生成元数据快照，用于自动保存变更检测
  const getMetaSnapshot = useCallback(
    (f: typeof form) =>
      JSON.stringify({
        title: f.title,
        path: f.path,
        template: f.template,
        seoTitle: f.seoTitle,
        seoDescription: f.seoDescription,
      }),
    [],
  )

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
          const draft = p.draftContent as PageDraftContent | null
          const contentRaw = draft ? draft.contentRaw : p.contentRaw
          const contentHtml = draft ? draft.contentHtml : p.contentHtml
          const initialPath = draft ? draft.path : p.path || ''

          setForm({
            title: draft ? draft.title : p.title,
            path: initialPath,
            template: draft ? draft.template : p.template,
            status: p.status,
            seoTitle: draft ? draft.seoTitle : p.seoTitle || '',
            seoDescription: draft ? draft.seoDescription : p.seoDescription || '',
          })
          setPathError(initialPath ? validatePath(initialPath) : null)

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
          lastAutoSaveMetaRef.current = getMetaSnapshot({
            title: draft ? draft.title : p.title,
            path: initialPath,
            template: draft ? draft.template : p.template,
            status: p.status,
            seoTitle: draft ? draft.seoTitle : p.seoTitle || '',
            seoDescription: draft ? draft.seoDescription : p.seoDescription || '',
          })
          if (draft) {
            setAutoSaveTime(draft.updatedAt)
          }
        }
      })
  }, [pageId])

  // 同步 ref
  useEffect(() => {
    formRef.current = form
  }, [form])
  useEffect(() => {
    textContentRef.current = textContent
  }, [textContent])
  useEffect(() => {
    contentTypeRef.current = contentType
  }, [contentType])

  const getCurrentContent = useCallback(() => {
    const ct = contentTypeRef.current
    const ed = richTextRef.current?.getEditor()
    let contentRaw = ''
    let contentHtml = ''
    let contentText = ''

    if (ct === 'richtext' && ed) {
      contentHtml = ed.getHTML()
      contentText = ed.getText()
      contentRaw = contentHtml
    } else if (ct === 'html') {
      contentRaw = textContentRef.current
      contentHtml = textContentRef.current
    } else {
      contentRaw = textContentRef.current
      contentText = textContentRef.current
    }

    return {
      contentType: ct,
      contentRaw,
      contentHtml,
      contentText,
    }
  }, [])

  const saveDraftRevision = useCallback(
    async (targetId: number, formState: typeof form, content = getCurrentContent()) => {
      const res = await fetch(`/api/pages/${targetId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPageDraftPayload(formState, content)),
      })

      return {
        json: await res.json(),
        content,
      }
    },
    [getCurrentContent],
  )

  const ensurePendingPageId = useCallback(async (silent = false) => {
    if (pendingCreatedPageIdRef.current) return pendingCreatedPageIdRef.current

    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createEmpty: true }),
    })
    const json = await res.json()
    if (!json.success) {
      if (!silent) {
        notify({ color: 'red', message: json.message || '创建草稿失败' })
      }
      return null
    }

    pendingCreatedPageIdRef.current = json.data.id
    return json.data.id as number
  }, [])

  // 创建空草稿并保存完整草稿快照后跳转到编辑页
  const createAndRedirect = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (creatingRef.current) return
      creatingRef.current = true
      let redirected = false

      try {
        const newId = await ensurePendingPageId(silent)
        if (!newId) {
          return
        }
        const formState = formRef.current
        const content = getCurrentContent()

        // 保存完整草稿快照，允许 path 暂时非法或重复
        const draftSave = await saveDraftRevision(newId, formState, content)
        if (!draftSave.json.success) {
          if (!silent) {
            notify({ color: 'red', message: draftSave.json.message || '保存草稿失败' })
          }
          return
        }

        redirected = true
        pendingCreatedPageIdRef.current = null
        router.replace(`/admin/pages/${newId}`)
      } catch {
        if (!silent) {
          notify({ color: 'red', message: '网络错误' })
        }
      }

      if (!redirected) {
        creatingRef.current = false
      }
    },
    [ensurePendingPageId, getCurrentContent, router, saveDraftRevision],
  )

  // 自动保存定时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (autoSavingRef.current) return
      const content = getCurrentContent()

      // 新页面：首次有实际内容时创建记录并跳转
      if (!pageId) {
        if (
          shouldCreateDraftRecord({
            title: formRef.current.title,
            contentType: content.contentType,
            currentContent: content.contentRaw,
            richTextText: content.contentText,
          })
        ) {
          void createAndRedirect({ silent: true })
        }
        return
      }

      const currentMeta = getMetaSnapshot(formRef.current)
      const contentChanged = content.contentRaw && content.contentRaw !== lastAutoSaveContent.current
      const metaChanged = currentMeta !== lastAutoSaveMetaRef.current
      if (!contentChanged && !metaChanged) return

      autoSavingRef.current = true
      saveDraftRevision(pageId, formRef.current, content)
        .then(({ json }) => {
          if (json.success) {
            lastAutoSaveContent.current = content.contentRaw
            lastAutoSaveMetaRef.current = currentMeta
            setAutoSaveTime(json.data.updatedAt)
          }
        })
        .catch(() => {})
        .finally(() => {
          autoSavingRef.current = false
        })
    }, 5000)

    return () => clearInterval(timer)
  }, [pageId, createAndRedirect, getCurrentContent, getMetaSnapshot, saveDraftRevision])

  const handlePathChange = (value: string) => {
    setForm((prev) => ({ ...prev, path: value }))
    setPathError(validatePath(value))
  }

  // 手动保存草稿：仅保存完整草稿快照，不阻塞于 path 校验
  const handleSaveDraft = async () => {
    if (!pageId) {
      await createAndRedirect()
      return
    }

    setLoading(true)
    try {
      const formState = formRef.current
      const draftSave = await saveDraftRevision(pageId, formState)
      if (draftSave.json.success) {
        lastAutoSaveContent.current = draftSave.content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        setAutoSaveTime(draftSave.json.data.updatedAt)
        notify({ color: 'green', message: '草稿已保存' })
      } else {
        notify({ color: 'red', message: draftSave.json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (status?: string) => {
    // 仅发布时校验必填字段
    if (status === 'published') {
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
    }

    const content = getCurrentContent()

    setLoading(true)
    try {
      const targetPageId = pageId ?? pendingCreatedPageIdRef.current
      const url = targetPageId ? `/api/pages/${targetPageId}` : '/api/pages'
      const method = targetPageId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPageSaveBody(form, content, status)),
      })
      const json = await res.json()
      if (json.success) {
        if (!pageId) {
          const nextId = targetPageId ?? json.data.id
          pendingCreatedPageIdRef.current = null
          notify({ color: 'green', message: '创建成功' })
          router.push(`/admin/pages/${nextId}`)
        } else {
          const newStatus = status || form.status
          setForm((prev) => ({ ...prev, status: newStatus }))
          let msg = '保存成功'
          if (status === 'published') msg = '发布成功'
          else if (status === 'draft' && form.status !== 'draft') msg = '已转为草稿'
          notify({ color: 'green', message: msg })
          lastAutoSaveContent.current = content.contentRaw
          lastAutoSaveMetaRef.current = getMetaSnapshot({
            ...form,
            status: status || form.status,
          })
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
                onClick={handleSaveDraft}
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
