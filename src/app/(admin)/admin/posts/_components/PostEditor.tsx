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
  Alert,
  Badge,
  Button,
  Checkbox,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import '@mantine/dates/styles.css'
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconDeviceFloppy,
  IconSend,
  IconX,
} from '@tabler/icons-react'
import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import RevisionHistory from './RevisionHistory'

interface Category {
  id: number
  name: string
  slug: string
}

interface Tag {
  id: number
  name: string
  slug: string
}

interface PostData {
  id: number
  title: string
  slug: string
  contentType: 'richtext' | 'markdown' | 'html'
  contentRaw: string
  contentHtml: string
  contentText: string
  excerpt: string | null
  status: string
  categoryId: number | null
  tagIds: number[]
  allowComment: boolean
  showComments: boolean
  pinned: boolean
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  publishedAt: string | null
}

interface FormState {
  title: string
  slug: string
  contentRaw: string
  excerpt: string
  status: string
  categoryId: string
  tagNames: string[]
  allowComment: boolean
  showComments: boolean
  pinned: boolean
  publishedAt: string | null
  seoTitle: string
  seoDescription: string
}

export default function PostEditor({ postId }: { postId?: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [contentType, setContentType] = useState<ContentType>('richtext')
  const [textContent, setTextContent] = useState('') // markdown 或 html 模式下的文本内容
  const [dirty, setDirty] = useState(false)
  const [globalCommentOff, setGlobalCommentOff] = useState(false)
  const [globalShowCommentsOff, setGlobalShowCommentsOff] = useState(false)
  const savedSnapshot = useRef<string>('')
  const editorDirty = useRef(false)

  // 发布设置面板
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
  const [publishTab, setPublishTab] = useState<string>('draft')

  // 自动保存状态
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null)
  const lastAutoSaveContent = useRef<string>('')
  const autoSavingRef = useRef(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 图片上传：存储配置状态
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

  // 富文本编辑器引用
  const richTextRef = useRef<RichTextEditorHandle>(null)
  const pendingEditorContent = useRef<string | null>(null)

  const [form, setForm] = useState<FormState>({
    title: '',
    slug: '',
    contentRaw: '',
    excerpt: '',
    status: 'draft',
    categoryId: '',
    tagNames: [],
    allowComment: true,
    showComments: true,
    pinned: false,
    publishedAt: null,
    seoTitle: '',
    seoDescription: '',
  })

  // 生成快照用于比较是否有修改
  const makeSnapshot = useCallback(
    (f: FormState, tc: string) => JSON.stringify({ ...f, textContent: tc }),
    [],
  )

  const checkDirty = useCallback(
    (f: FormState, tc: string) => {
      if (!savedSnapshot.current) return false
      return savedSnapshot.current !== makeSnapshot(f, tc)
    },
    [makeSnapshot],
  )

  // 获取富文本编辑器实例的辅助函数
  const getEditor = useCallback(() => richTextRef.current?.getEditor() ?? null, [])

  // 加载分类、标签和全局设置
  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/tags').then((r) => r.json()),
      fetch('/api/settings/editor').then((r) => r.json()),
    ]).then(([catData, tagData, settingsData]) => {
      if (catData.success) setCategories(catData.data)
      if (tagData.success) setAllTags(tagData.data)
      if (settingsData.success) {
        const s = settingsData.data
        setGlobalCommentOff(s.enableComment === 'false')
        setGlobalShowCommentsOff(s.showCommentsGlobally === 'false')
      }
    })
  }, [])

  // 加载文章数据
  useEffect(() => {
    if (!postId) return

    fetch(`/api/posts/${postId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          notify({ color: 'red', message: '文章不存在' })
          router.push('/admin/posts')
          return
        }

        const postData: PostData = json.data
        setForm({
          title: postData.title,
          slug: postData.slug,
          contentRaw: postData.contentRaw,
          excerpt: postData.excerpt || '',
          status: postData.status,
          categoryId: postData.categoryId ? String(postData.categoryId) : '',
          tagNames: json.data.tagNames || [],
          allowComment: postData.allowComment,
          showComments: postData.showComments,
          pinned: postData.pinned,
          publishedAt: postData.publishedAt,
          seoTitle: postData.seoTitle || '',
          seoDescription: postData.seoDescription || '',
        })

        // 优先使用草稿内容（如果有）
        const draft = json.data.draftContent
        const contentRaw = draft ? draft.contentRaw : postData.contentRaw
        const contentHtml = draft ? draft.contentHtml : postData.contentHtml

        if (draft) {
          if (draft.title) setForm((prev) => ({ ...prev, title: draft.title }))
          if (draft.excerpt) setForm((prev) => ({ ...prev, excerpt: draft.excerpt }))
        }

        // 根据持久化的 contentType 恢复编辑模式
        const effectiveCT = (draft?.contentType ||
          postData.contentType ||
          'richtext') as ContentType
        setContentType(effectiveCT)
        contentTypeRef.current = effectiveCT

        if (effectiveCT === 'richtext' && contentHtml) {
          const ed = getEditor()
          if (ed) {
            ed.commands.setContent(contentHtml)
          } else {
            pendingEditorContent.current = contentHtml
          }
        }

        setTextContent(contentRaw)
        lastAutoSaveContent.current = contentRaw

        // 初始化发布设置面板和定时发布时间
        setPublishTab(
          postData.status === 'published'
            ? 'published'
            : postData.status === 'scheduled'
              ? 'scheduled'
              : 'draft',
        )
        if (postData.publishedAt && postData.status === 'scheduled') {
          setScheduledTime(new Date(postData.publishedAt))
        }

        if (draft) {
          setAutoSaveTime(draft.updatedAt)
        }

        // 保存初始快照
        const formData: FormState = {
          title: postData.title,
          slug: postData.slug,
          contentRaw,
          excerpt: postData.excerpt || '',
          status: postData.status,
          categoryId: postData.categoryId ? String(postData.categoryId) : '',
          tagNames: json.data.tagNames || [],
          allowComment: postData.allowComment,
          showComments: postData.showComments,
          pinned: postData.pinned,
          publishedAt: postData.publishedAt,
          seoTitle: postData.seoTitle || '',
          seoDescription: postData.seoDescription || '',
        }
        savedSnapshot.current = makeSnapshot(formData, contentRaw)
        editorDirty.current = false
        // 有未发布的草稿时显示「已修改」
        setDirty(!!draft)
      })
  }, [postId, getEditor, makeSnapshot])

  // 同步 ref 以供定时器读取最新值
  const textContentRef = useRef(textContent)
  const contentTypeRef = useRef(contentType)
  const formMetaRef = useRef({ title: form.title, excerpt: form.excerpt })
  useEffect(() => {
    textContentRef.current = textContent
  }, [textContent])
  useEffect(() => {
    contentTypeRef.current = contentType
  }, [contentType])
  useEffect(() => {
    formMetaRef.current = { title: form.title, excerpt: form.excerpt }
  }, [form.title, form.excerpt])

  // 自动保存定时器
  useEffect(() => {
    if (!postId) return

    const timer = setInterval(() => {
      if (autoSavingRef.current) return
      const ct = contentTypeRef.current
      const ed = getEditor()
      const currentContent = ct === 'richtext' ? ed?.getHTML() || '' : textContentRef.current
      if (!currentContent || currentContent === lastAutoSaveContent.current) return

      let contentRaw = currentContent
      let contentHtml = ''
      let contentText = ''

      if (ct === 'richtext') {
        contentHtml = currentContent
        contentText = ed?.getText() || ''
      } else if (ct === 'html') {
        contentHtml = currentContent
      }
      // markdown: 服务端渲染

      autoSavingRef.current = true
      fetch(`/api/posts/${postId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formMetaRef.current,
          contentRaw,
          contentHtml,
          contentText,
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
        .finally(() => {
          autoSavingRef.current = false
        })
    }, 5000)

    return () => clearInterval(timer)
  }, [postId, getEditor])

  // 手动保存草稿（仅保存到 content_revisions，不影响文章状态）
  const handleSaveDraft = async () => {
    if (!postId) {
      // 新文章：先创建文章
      await handleSave('draft')
      return
    }

    setLoading(true)
    try {
      let contentRaw = ''
      let contentHtml = ''
      let contentText = ''
      const ed = getEditor()

      if (contentType === 'richtext' && ed) {
        contentHtml = ed.getHTML()
        contentText = ed.getText()
        contentRaw = contentHtml
      } else if (contentType === 'html') {
        contentRaw = textContent
        contentHtml = textContent
      } else {
        // markdown
        contentRaw = textContent
      }

      const res = await fetch(`/api/posts/${postId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          contentRaw,
          contentHtml,
          contentText,
          contentType,
        }),
      })
      const json = await res.json()

      if (json.success) {
        lastAutoSaveContent.current = contentRaw
        setAutoSaveTime(json.data.updatedAt)
        notify({ color: 'green', message: '草稿已保存' })
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  // 保存文章到主表（发布、定时发布、转为草稿等）
  const handleSave = async (saveStatus?: string, overrides?: { publishedAt?: string | null }) => {
    const status = saveStatus || 'published'

    if (!form.title) {
      notify({ color: 'red', message: '标题不能为空' })
      return
    }

    if (!form.slug) {
      notify({ color: 'red', message: 'Slug 不能为空' })
      return
    }

    setLoading(true)
    try {
      let contentHtml = ''
      let contentText = ''
      let contentRaw = ''
      const ed = getEditor()

      if (contentType === 'richtext' && ed) {
        contentHtml = ed.getHTML()
        contentText = ed.getText()
        contentRaw = contentHtml
      } else if (contentType === 'html') {
        contentRaw = textContent
        contentHtml = textContent
      } else {
        // markdown
        contentRaw = textContent
      }

      // 解析标签名到 ID，不存在的自动创建
      const tagIds: number[] = []
      for (const name of form.tagNames) {
        const existing = allTags.find((t) => t.name === name)
        if (existing) {
          tagIds.push(existing.id)
        } else {
          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
            .replace(/^-|-$/g, '')
          const res = await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, slug }),
          })
          const json = await res.json()
          if (json.success) {
            setAllTags((prev) => [...prev, json.data])
            tagIds.push(json.data.id)
          }
        }
      }

      const body: Record<string, any> = {
        title: form.title,
        slug: form.slug,
        contentRaw,
        contentHtml,
        contentText,
        contentType,
        excerpt: form.excerpt || undefined,
        status,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
        tagIds,
        allowComment: form.allowComment,
        showComments: form.showComments,
        pinned: form.pinned,
        publishedAt:
          overrides?.publishedAt !== undefined
            ? overrides.publishedAt
            : status === 'draft'
              ? null
              : form.publishedAt || new Date().toISOString(),
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
      }

      const url = postId ? `/api/posts/${postId}` : '/api/posts'
      const method = postId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        const newPublishedAt =
          overrides?.publishedAt !== undefined ? overrides.publishedAt : form.publishedAt
        setForm((prev) => ({ ...prev, status, publishedAt: newPublishedAt }))
        setPublishTab(
          status === 'published' ? 'published' : status === 'scheduled' ? 'scheduled' : 'draft',
        )
        let msg = '发布成功'
        if (status === 'draft') msg = '已转为草稿'
        else if (status === 'scheduled') msg = '定时发布已设置'
        notify({ color: 'green', message: msg })
        savedSnapshot.current = makeSnapshot(
          { ...form, status, publishedAt: newPublishedAt },
          textContent,
        )
        editorDirty.current = false
        setDirty(false)
        const currentContent =
          contentType === 'richtext' ? getEditor()?.getHTML() || '' : textContent
        lastAutoSaveContent.current = currentContent
        setAutoSaveTime(null)
        if (!postId) {
          router.push(`/admin/posts/${json.data.id}`)
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

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      setDirty(checkDirty(next, textContent) || editorDirty.current)
      return next
    })
  }

  // 自动生成 slug（简易实现）
  const generateSlug = () => {
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '')
    setField('slug', slug || '')
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* 固定在右上角的保存/发布按钮 */}
      <Group
        gap="xs"
        style={{
          position: 'sticky',
          top: 'var(--mantine-spacing-sm)',
          float: 'right',
          zIndex: 100,
          padding: 'var(--mantine-spacing-xs)',
          borderRadius: 'var(--mantine-radius-md)',
          // backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 70%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Button
          variant="default"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSaveDraft}
          loading={loading}
        >
          保存
        </Button>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={async () => {
            if (form.status !== 'published') {
              if (!(await myModal.confirm({ message: '确定要发布这篇文章吗？' }))) return
            }
            await handleSave()
          }}
          loading={loading}
        >
          发布
        </Button>
      </Group>

      <Group mb="lg">
        <Button
          variant="subtle"
          component={Link}
          href="/admin/posts"
          leftSection={<IconArrowLeft size={16} />}
        >
          返回
        </Button>
        <Title order={3}>{postId ? '编辑文章' : '新建文章'}</Title>
        {postId && (
          <Badge color={form.status === 'published' ? 'green' : 'gray'} variant="light" size="lg">
            {form.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        )}
        {dirty && (
          <Group gap={4}>
            <Badge color="orange" variant="light" size="lg">
              已修改
            </Badge>
            {postId && form.status === 'published' && (
              <IconX
                size={16}
                color="var(--mantine-color-orange-6)"
                style={{ cursor: 'pointer' }}
                onClick={async () => {
                  if (!(await myModal.confirm({ message: '是否要放弃所有未发布的修改？' }))) return
                  // 先删除草稿，再重新加载已发布内容
                  await fetch(`/api/posts/${postId}/draft`, { method: 'DELETE' })
                  const res = await fetch(`/api/posts/${postId}`)
                  const json = await res.json()
                  if (!json.success) return
                  const postData = json.data
                  const restoreCT = (postData.contentType || 'richtext') as ContentType
                  setContentType(restoreCT)
                  contentTypeRef.current = restoreCT
                  if (restoreCT === 'richtext') {
                    const ed = getEditor()
                    if (ed) ed.commands.setContent(postData.contentHtml)
                  }
                  setTextContent(postData.contentRaw)
                  lastAutoSaveContent.current = postData.contentRaw
                  textContentRef.current = postData.contentRaw
                  editorDirty.current = false
                  setDirty(false)
                  setAutoSaveTime(null)
                }}
              />
            )}
          </Group>
        )}
        {autoSaveTime && (
          <Text size="sm" c="dimmed">
            自动保存：{dayjs(autoSaveTime).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        )}
      </Group>

      <Grid>
        {/* 主编辑区 */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <TextInput
              label="标题"
              placeholder="文章标题"
              size="lg"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />

            <Group align="flex-end">
              <TextInput
                label="Slug"
                placeholder="post-url-slug"
                style={{ flex: 1 }}
                value={form.slug}
                onChange={(e) => setField('slug', e.target.value)}
              />
              <Button variant="light" size="sm" onClick={generateSlug}>
                自动生成
              </Button>
            </Group>

            <Group>
              <ContentTypeSelector
                value={contentType}
                onChange={async (newType) => {
                  if (newType === contentType) return
                  const warning = '切换内容类型可能导致格式或数据丢失，确定要切换吗？'
                  if (!(await myModal.confirm({ message: warning }))) return

                  const ed = getEditor()
                  let contentRaw = ''
                  let contentHtml = ''
                  let contentText = ''

                  // 从当前类型导出内容
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
                    contentHtml = currentHtml
                    contentText = ed?.getText() || ''
                    contentRaw = currentHtml
                  } else if (newType === 'markdown') {
                    const md =
                      contentType === 'markdown' ? textContent : htmlToMarkdown(currentHtml)
                    setTextContent(md)
                    textContentRef.current = md
                    contentRaw = md
                  } else {
                    // html
                    const html = contentType === 'html' ? textContent : currentHtml
                    setTextContent(html)
                    textContentRef.current = html
                    contentRaw = html
                    contentHtml = html
                  }

                  setContentType(newType)
                  contentTypeRef.current = newType

                  // 标记为已修改并立即保存草稿
                  setDirty(true)
                  setAutoSaveTime(null)
                  if (postId) {
                    fetch(`/api/posts/${postId}/draft`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: form.title,
                        excerpt: form.excerpt,
                        contentRaw,
                        contentHtml,
                        contentText,
                        contentType: newType,
                      }),
                    })
                      .then((r) => r.json())
                      .then((json) => {
                        if (json.success) {
                          lastAutoSaveContent.current = contentRaw
                          setAutoSaveTime(json.data.updatedAt)
                        }
                      })
                      .catch(() => {})
                  }
                }}
              />
            </Group>

            {/* 富文本编辑器（用 display:none 隐藏而非卸载） */}
            <RichTextEditorWrapper
              editorRef={richTextRef}
              placeholder="开始撰写文章内容..."
              onImageUpload={uploadImage}
              checkStorageConfig={checkStorageConfig}
              onUpdate={() => {
                editorDirty.current = true
                setDirty(true)
                setAutoSaveTime(null)
              }}
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
                placeholder={
                  contentType === 'markdown' ? '在此输入 Markdown...' : '在此输入 HTML...'
                }
                autosize
                minRows={20}
                value={textContent}
                onChange={(e) => {
                  setTextContent(e.target.value)
                  setDirty(checkDirty(form, e.target.value))
                  setAutoSaveTime(null)
                }}
                styles={{ input: { fontFamily: 'monospace', maxHeight: 600, overflowY: 'auto' } }}
              />
            )}

            <Textarea
              label="摘要"
              placeholder="文章摘要（可选，留空则自动截取）"
              autosize
              minRows={3}
              value={form.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
            />
          </Stack>
        </Grid.Col>

        {/* 侧边栏设置 */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack>
            <Paper withBorder p="md" mih={200}>
              <Text fw={500} mb="sm">
                发布设置
              </Text>
              <SegmentedControl
                fullWidth
                value={publishTab}
                data={[
                  { value: 'draft', label: '草稿' },
                  { value: 'scheduled', label: '定时发布' },
                  { value: 'published', label: '已发布' },
                ]}
                onChange={setPublishTab}
              />

              {/* 草稿 */}
              {publishTab === 'draft' && (
                <Stack mt="sm" gap="xs">
                  {form.status === 'draft' ? (
                    <Text size="sm" c="dimmed">
                      当前为草稿状态
                    </Text>
                  ) : (
                    <Button
                      variant="light"
                      color="orange"
                      fullWidth
                      onClick={async () => {
                        if (
                          !(await myModal.confirm({
                            message:
                              '确定要将当前文章转为草稿状态吗？这个操作将撤销文章发布，使其对外部不可见。',
                          }))
                        )
                          return
                        setScheduledTime(null)
                        await handleSave('draft', { publishedAt: null })
                      }}
                      loading={loading}
                    >
                      转为草稿
                    </Button>
                  )}
                </Stack>
              )}

              {/* 定时发布 */}
              {publishTab === 'scheduled' && (
                <Stack mt="sm" gap="xs">
                  {form.status === 'published' ? (
                    <Text size="sm" c="dimmed">
                      文章已发布，无需定时发布。
                    </Text>
                  ) : (
                    <>
                      <DateTimePicker
                        label="发布时间"
                        placeholder="选择日期和时间"
                        value={scheduledTime}
                        onChange={(v) => setScheduledTime(v as Date | null)}
                        minDate={new Date()}
                      />
                      <Button
                        fullWidth
                        disabled={!scheduledTime}
                        onClick={async () => {
                          if (!scheduledTime) return
                          const timeStr = dayjs(scheduledTime).format('YYYY-MM-DD HH:mm:ss')
                          if (
                            !(await myModal.confirm({
                              message: `确定要将文章设为定时发布吗？\n\n发布时间：${timeStr}`,
                            }))
                          )
                            return
                          await handleSave('scheduled', {
                            publishedAt: scheduledTime.toISOString(),
                          })
                        }}
                        loading={loading}
                      >
                        {form.status === 'scheduled' ? '更新定时发布' : '设为定时发布'}
                      </Button>
                    </>
                  )}
                </Stack>
              )}

              {/* 已发布 */}
              {publishTab === 'published' && (
                <Stack mt="sm" gap="xs">
                  {form.publishedAt && (
                    <Text size="sm" c="dimmed">
                      发布时间：{dayjs(form.publishedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  )}
                  {form.status === 'published' && dirty && (
                    <Text size="sm" c="orange">
                      当前有未发布的修改，可点击顶部「发布」按钮再次发布。
                    </Text>
                  )}
                </Stack>
              )}
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                其他设置
              </Text>
              <Checkbox
                label="置顶"
                checked={form.pinned}
                onChange={(e) => setField('pinned', e.currentTarget.checked)}
              />
              {postId && (
                <Button variant="subtle" fullWidth mt="sm" onClick={() => setHistoryOpen(true)}>
                  查看历史版本
                </Button>
              )}
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                分类与标签
              </Text>
              <Select
                label="分类"
                placeholder="选择分类"
                clearable
                searchable
                data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                value={form.categoryId}
                onChange={(v) => setField('categoryId', v || '')}
              />

              <TagsInput
                label="标签"
                placeholder="输入标签名，回车添加"
                mt="sm"
                data={allTags.map((t) => t.name)}
                value={form.tagNames}
                onChange={(v) => setField('tagNames', v)}
              />
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                评论
              </Text>
              {(globalCommentOff || globalShowCommentsOff) && (
                <Alert
                  variant="light"
                  color="orange"
                  icon={<IconAlertTriangle size={16} />}
                  mb="sm"
                  p="xs"
                  fz="xs"
                >
                  {globalCommentOff && globalShowCommentsOff
                    ? '评论和评论列表显示已在系统设置中全局关闭，此处的设置不会生效。'
                    : globalCommentOff
                      ? '评论已在系统设置中全局关闭，"允许评论"设置不会生效。'
                      : '评论列表显示已在系统设置中全局关闭，"显示评论"设置不会生效。'}
                </Alert>
              )}
              <Checkbox
                label="允许评论"
                checked={form.allowComment}
                onChange={(e) => setField('allowComment', e.currentTarget.checked)}
              />
              <Checkbox
                label="显示评论"
                mt="xs"
                checked={form.showComments}
                onChange={(e) => setField('showComments', e.currentTarget.checked)}
              />
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                SEO
              </Text>
              <TextInput
                label="SEO 标题"
                placeholder="可选"
                value={form.seoTitle}
                onChange={(e) => setField('seoTitle', e.target.value)}
              />
              <Textarea
                label="SEO 描述"
                placeholder="可选"
                mt="sm"
                autosize
                minRows={2}
                value={form.seoDescription}
                onChange={(e) => setField('seoDescription', e.target.value)}
              />
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      {/* 历史版本 */}
      {postId && (
        <RevisionHistory
          targetType="post"
          targetId={postId}
          opened={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={() => {
            // 重新加载文章数据
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
