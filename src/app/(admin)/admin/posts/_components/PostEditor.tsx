'use client'

import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { EditorHeader } from '@/app/(admin)/_components/EditorHeader'
import myModal from '@/app/(admin)/_components/myModals'
import PublishSettings from '@/app/(admin)/_components/PublishSettings'
import {
  type ContentType,
  htmlToMarkdown,
  renderMarkdownToHtml,
} from '@/components/editors/content-convert'
import ContentTypeSelector from '@/components/editors/ContentTypeSelector'
import RichTextEditorWrapper, {
  type RichTextEditorHandle,
} from '@/components/editors/RichTextEditorWrapper'
import { getClientErrorMessage } from '@/lib/client-error'
import { notify } from '@/lib/notify'
import {
  Alert,
  Button,
  Checkbox,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { shouldCreateDraftRecord } from '../../_lib/draft-persistence'
import { buildPostDraftPayload, buildPostSaveBody } from './post-save-payload'
import RevisionHistory from './RevisionHistory'

const AUTO_SAVE_FAIL_ID = 'auto-save-fail'

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
  coverImage: string | null
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  publishedAt: string | null
}

interface PostDraftContent {
  title: string
  slug: string
  excerpt: string
  contentType: ContentType
  contentRaw: string
  contentHtml: string
  contentText: string
  categoryId: number | null
  tagNames: string[]
  coverImage: string
  seoTitle: string
  seoDescription: string
  publishedAt: string | null
  updatedAt: string
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
  coverImage: string
  publishedAt: string | null
  seoTitle: string
  seoDescription: string
}

function createEmptyPostForm(): FormState {
  return {
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
    coverImage: '',
    publishedAt: null,
    seoTitle: '',
    seoDescription: '',
  }
}

export default function PostEditor({ postId }: { postId?: number }) {
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const t = useTranslations('admin.editor.post')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const allTagsRef = useRef<Tag[]>([])
  const [contentType, setContentType] = useState<ContentType>('richtext')
  const [textContent, setTextContent] = useState('') // markdown 或 html 模式下的文本内容
  const [dirty, setDirty] = useState(false)
  const [globalCommentOff, setGlobalCommentOff] = useState(false)
  const [globalShowCommentsOff, setGlobalShowCommentsOff] = useState(false)
  const savedSnapshot = useRef<string>('')
  const editorDirty = useRef(false)

  // 发布设置面板
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)
  const [publishTab, setPublishTab] = useState<string>('draft')

  // 自动保存状态
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null)
  const lastAutoSaveContent = useRef<string>('')
  const lastAutoSaveMetaRef = useRef<string>('')
  const autoSavingRef = useRef(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const creatingRef = useRef(false) // 防止重复创建空草稿
  const pendingCreatedPostIdRef = useRef<number | null>(null)
  const skipInitialLoadForCreatedPostIdRef = useRef<number | null>(null)
  const routePostIdRef = useRef<number | undefined>(postId)

  // 自动保存失败计数
  const autoSaveFailCountRef = useRef(0)
  const onAutoSaveFail = useCallback(() => {
    autoSaveFailCountRef.current += 1
    if (autoSaveFailCountRef.current >= 3) {
      notify({
        id: AUTO_SAVE_FAIL_ID,
        color: 'red',
        message: t('autoSaveFailed'),
        autoClose: false,
      })
    }
  }, [t])
  const clearAutoSaveFail = useCallback(() => {
    autoSaveFailCountRef.current = 0
    notifications.hide(AUTO_SAVE_FAIL_ID)
  }, [])

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

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/attachments', { method: 'POST', body: formData })
        const json = await res.json()
        if (!json.success) throw new Error(json.message || tCommon('errors.uploadFailed'))
        return json.data.publicUrl
      } catch (error) {
        const message = getClientErrorMessage(error, {
          networkMessage: tCommon('errors.network'),
          fallbackMessage: tCommon('errors.uploadFailed'),
        })
        throw new Error(message)
      }
    },
    [tCommon],
  )

  // 富文本编辑器引用
  const richTextRef = useRef<RichTextEditorHandle>(null)
  const pendingEditorContent = useRef<string | null>(null)

  const [form, setForm] = useState<FormState>(createEmptyPostForm)
  const formRef = useRef(form)
  const textContentRef = useRef(textContent)
  const contentTypeRef = useRef(contentType)

  // 生成元数据快照，用于自动保存变更检测
  const getMetaSnapshot = useCallback(
    (f: FormState) =>
      JSON.stringify({
        title: f.title,
        slug: f.slug,
        excerpt: f.excerpt,
        categoryId: f.categoryId,
        tagNames: f.tagNames,
        coverImage: f.coverImage,
        seoTitle: f.seoTitle,
        seoDescription: f.seoDescription,
        publishedAt: f.publishedAt,
      }),
    [],
  )

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

  const resetEditorState = useCallback(
    ({ keepLoading = false }: { keepLoading?: boolean } = {}) => {
      const nextForm = createEmptyPostForm()
      const editor = getEditor()

      if (editor) {
        editor.commands.setContent('')
      }

      pendingEditorContent.current = null
      setForm(nextForm)
      formRef.current = nextForm
      setContentType('richtext')
      contentTypeRef.current = 'richtext'
      setTextContent('')
      textContentRef.current = ''
      lastAutoSaveContent.current = ''
      lastAutoSaveMetaRef.current = getMetaSnapshot(nextForm)
      savedSnapshot.current = makeSnapshot(nextForm, '')
      editorDirty.current = false
      pendingCreatedPostIdRef.current = null
      skipInitialLoadForCreatedPostIdRef.current = null
      creatingRef.current = false
      setDirty(false)
      setAutoSaveTime(null)
      setScheduledTime(null)
      setPublishTab('draft')
      setHistoryOpen(false)
      setLoading(keepLoading)
      clearAutoSaveFail()
    },
    [clearAutoSaveFail, getEditor, getMetaSnapshot, makeSnapshot],
  )

  // 加载分类、标签和全局设置
  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/tags').then((r) => r.json()),
      fetch('/api/settings/editor').then((r) => r.json()),
    ]).then(([catData, tagData, settingsData]) => {
      if (catData.success) setCategories(catData.data)
      if (tagData.success) {
        setAllTags(tagData.data)
        allTagsRef.current = tagData.data
      }
      if (settingsData.success) {
        const s = settingsData.data
        setGlobalCommentOff(s.enableComment === false)
        setGlobalShowCommentsOff(s.showCommentsGlobally === false)
      }
    })
  }, [])

  // 加载文章数据
  useEffect(() => {
    const previousPostId = routePostIdRef.current
    routePostIdRef.current = postId

    if (skipInitialLoadForCreatedPostIdRef.current === postId) {
      skipInitialLoadForCreatedPostIdRef.current = null
      pendingCreatedPostIdRef.current = null
      setLoading(false)
      return
    }

    if (!postId) {
      resetEditorState()
      return
    }

    if (previousPostId !== undefined && previousPostId !== postId) {
      resetEditorState({ keepLoading: true })
    } else {
      setLoading(true)
    }

    const controller = new AbortController()
    let active = true

    fetch(`/api/posts/${postId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!active) return

        if (!json.success) {
          notify({ color: 'red', message: t('notFound') })
          router.push(adminUrl('/posts'))
          return
        }

        const postData: PostData = json.data
        const baseForm: FormState = {
          title: postData.title,
          slug: postData.slug || '',
          excerpt: postData.excerpt || '',
          status: postData.status,
          categoryId: postData.categoryId ? String(postData.categoryId) : '',
          tagNames: json.data.tagNames || [],
          allowComment: postData.allowComment,
          showComments: postData.showComments,
          pinned: postData.pinned,
          coverImage: postData.coverImage || '',
          publishedAt: postData.publishedAt,
          seoTitle: postData.seoTitle || '',
          seoDescription: postData.seoDescription || '',
          contentRaw: postData.contentRaw,
        }

        // 优先使用草稿内容（如果有）
        const draft = json.data.draftContent as PostDraftContent | null
        const contentRaw = draft ? draft.contentRaw : postData.contentRaw
        const contentHtml = draft ? draft.contentHtml : postData.contentHtml
        const nextForm: FormState = draft
          ? {
              title: draft.title,
              slug: draft.slug,
              contentRaw,
              excerpt: draft.excerpt,
              status: postData.status,
              categoryId: draft.categoryId ? String(draft.categoryId) : '',
              tagNames: draft.tagNames,
              allowComment: postData.allowComment,
              showComments: postData.showComments,
              pinned: postData.pinned,
              coverImage: draft.coverImage || '',
              publishedAt: draft.publishedAt,
              seoTitle: draft.seoTitle,
              seoDescription: draft.seoDescription,
            }
          : baseForm

        setForm(nextForm)

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
        lastAutoSaveMetaRef.current = getMetaSnapshot(nextForm)

        // 初始化发布设置面板和定时发布时间
        setPublishTab(
          postData.status === 'published'
            ? 'published'
            : postData.status === 'scheduled'
              ? 'scheduled'
              : 'draft',
        )
        if (postData.publishedAt && postData.status === 'scheduled') {
          setScheduledTime(postData.publishedAt)
        } else {
          setScheduledTime(null)
        }

        if (draft) {
          setAutoSaveTime(draft.updatedAt)
        }

        // 保存初始快照
        savedSnapshot.current = makeSnapshot(nextForm, contentRaw)
        editorDirty.current = false
        // 有未发布的草稿时显示「已修改」
        setDirty(!!draft)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof Error && error.name === 'AbortError') return

        notify({ color: 'red', message: t('loadFailed') })
        router.push(adminUrl('/posts'))
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [postId, adminUrl, router, getEditor, getMetaSnapshot, makeSnapshot, resetEditorState, t])

  // 同步 ref 以供定时器读取最新值
  useEffect(() => {
    textContentRef.current = textContent
  }, [textContent])
  useEffect(() => {
    contentTypeRef.current = contentType
  }, [contentType])
  useEffect(() => {
    formRef.current = form
  }, [form])

  const getCurrentContent = useCallback(() => {
    const ct = contentTypeRef.current
    const ed = getEditor()
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
    }

    return {
      contentType: ct,
      contentRaw,
      contentHtml,
      contentText,
    }
  }, [getEditor])

  const resolveTagIds = useCallback(async (tagNames: string[]) => {
    const tagIds: number[] = []

    for (const name of tagNames) {
      const existing = allTagsRef.current.find((tag) => tag.name === name)
      if (existing) {
        tagIds.push(existing.id)
        continue
      }

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
      if (!json.success) continue

      const nextTags = [...allTagsRef.current, json.data]
      allTagsRef.current = nextTags
      setAllTags(nextTags)
      tagIds.push(json.data.id)
    }

    return tagIds
  }, [])

  const saveDraftRevision = useCallback(
    async (targetId: number, formState: FormState, content = getCurrentContent()) => {
      const res = await fetch(`/api/posts/${targetId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPostDraftPayload(formState, content)),
      })
      return {
        json: await res.json(),
        content,
      }
    },
    [getCurrentContent],
  )

  const ensurePendingPostId = useCallback(
    async (silent = false) => {
      if (pendingCreatedPostIdRef.current) return pendingCreatedPostIdRef.current

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createEmpty: true }),
      })
      const json = await res.json()
      if (!json.success) {
        if (!silent) {
          notify({ color: 'red', message: json.message || t('createDraftFailed') })
        }
        return null
      }

      pendingCreatedPostIdRef.current = json.data.id
      return json.data.id as number
    },
    [t],
  )

  const getTargetPostId = useCallback(() => postId ?? pendingCreatedPostIdRef.current, [postId])

  // 创建空草稿并保存完整草稿快照后跳转到真实编辑页
  const createAndRedirect = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const targetPostId = getTargetPostId()
      if (targetPostId) return targetPostId
      if (creatingRef.current) return pendingCreatedPostIdRef.current

      creatingRef.current = true

      try {
        const newId = await ensurePendingPostId(silent)
        if (!newId) {
          if (silent) onAutoSaveFail()
          return null
        }
        const formState = formRef.current
        const content = getCurrentContent()

        const draftSave = await saveDraftRevision(newId, formState, content)
        if (!draftSave.json.success) {
          if (silent) {
            onAutoSaveFail()
          } else {
            notify({
              color: 'red',
              message: draftSave.json.message || tCommon('errors.saveFailed'),
            })
          }
          return null
        }

        clearAutoSaveFail()
        pendingCreatedPostIdRef.current = newId
        lastAutoSaveContent.current = content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        textContentRef.current = content.contentRaw
        setTextContent(content.contentRaw)
        savedSnapshot.current = makeSnapshot(
          { ...formState, contentRaw: content.contentRaw },
          content.contentRaw,
        )
        setAutoSaveTime(draftSave.json.data.updatedAt)
        setDirty(true)
        skipInitialLoadForCreatedPostIdRef.current = newId
        router.replace(adminUrl(`/posts/${newId}`))
        return newId
      } catch {
        if (silent) {
          onAutoSaveFail()
        } else {
          notify({ color: 'red', message: tCommon('errors.network') })
        }
        return null
      } finally {
        creatingRef.current = false
      }
    },
    [
      getTargetPostId,
      ensurePendingPostId,
      getCurrentContent,
      saveDraftRevision,
      onAutoSaveFail,
      clearAutoSaveFail,
      getMetaSnapshot,
      makeSnapshot,
      router,
      adminUrl,
    ],
  )

  // 自动保存定时器
  useEffect(() => {
    const timer = setInterval(() => {
      if (autoSavingRef.current) return
      const content = getCurrentContent()

      const targetPostId = getTargetPostId()

      // 新文章：首次有实际内容时创建记录并跳转到真实编辑页
      if (!targetPostId) {
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
      const contentChanged =
        content.contentRaw && content.contentRaw !== lastAutoSaveContent.current
      const metaChanged = currentMeta !== lastAutoSaveMetaRef.current
      if (!contentChanged && !metaChanged) return

      autoSavingRef.current = true
      saveDraftRevision(targetPostId, formRef.current, content)
        .then(({ json }) => {
          if (json.success) {
            clearAutoSaveFail()
            lastAutoSaveContent.current = content.contentRaw
            lastAutoSaveMetaRef.current = currentMeta
            setAutoSaveTime(json.data.updatedAt)
          } else {
            onAutoSaveFail()
          }
        })
        .catch(() => {
          onAutoSaveFail()
        })
        .finally(() => {
          autoSavingRef.current = false
        })
    }, 5000)

    return () => clearInterval(timer)
  }, [
    getTargetPostId,
    createAndRedirect,
    getCurrentContent,
    getMetaSnapshot,
    saveDraftRevision,
    clearAutoSaveFail,
    onAutoSaveFail,
  ])

  // 预览：先保存草稿，再在新窗口打开预览
  const handlePreview = async () => {
    const targetPostId = getTargetPostId()
    if (!targetPostId) {
      await createAndRedirect()
      return
    }

    setLoading(true)
    try {
      const formState = formRef.current
      const draftSave = await saveDraftRevision(targetPostId, formState)
      if (draftSave.json.success) {
        lastAutoSaveContent.current = draftSave.content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        setAutoSaveTime(draftSave.json.data.updatedAt)
        window.open(`/posts/--preview-${targetPostId}`, '_blank')
      } else {
        notify({ color: 'red', message: draftSave.json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  // 手动保存草稿：仅保存完整草稿快照，不阻塞于 slug 校验
  const handleSaveDraft = async () => {
    const targetPostId = getTargetPostId()
    if (!targetPostId) {
      await createAndRedirect()
      return
    }

    setLoading(true)
    try {
      const formState = formRef.current
      const draftSave = await saveDraftRevision(targetPostId, formState)
      if (draftSave.json.success) {
        clearAutoSaveFail()
        lastAutoSaveContent.current = draftSave.content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        setAutoSaveTime(draftSave.json.data.updatedAt)
        notify({ color: 'green', message: t('draftSaved') })
      } else {
        notify({ color: 'red', message: draftSave.json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  // 保存文章到主表（发布、定时发布、转为草稿等）
  const handleSave = async (saveStatus?: string, overrides?: { publishedAt?: string | null }) => {
    const status = saveStatus || 'published'

    // 仅发布/定时发布时校验必填字段
    if (status !== 'draft') {
      if (!form.title) {
        notify({ color: 'red', message: t('titleRequired') })
        return
      }
      if (!form.slug) {
        notify({ color: 'red', message: t('slugRequired') })
        return
      }
    }

    setLoading(true)
    try {
      const content = getCurrentContent()
      const tagIds = await resolveTagIds(form.tagNames)
      const body = buildPostSaveBody(form, content, tagIds, status, {
        ...overrides,
        now: new Date().toISOString(),
      })

      const targetPostId = getTargetPostId()
      const url = targetPostId ? `/api/posts/${targetPostId}` : '/api/posts'
      const method = targetPostId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        clearAutoSaveFail()
        const newPublishedAt =
          overrides?.publishedAt !== undefined
            ? overrides.publishedAt
            : (json.data?.publishedAt ?? form.publishedAt)
        setForm((prev) => ({ ...prev, status, publishedAt: newPublishedAt }))
        setPublishTab(
          status === 'published' ? 'published' : status === 'scheduled' ? 'scheduled' : 'draft',
        )
        let msg = t('publishSuccess')
        if (status === 'draft') msg = t('convertedToDraft')
        else if (status === 'scheduled') msg = t('scheduledSet')
        notify({ color: 'green', message: msg })
        savedSnapshot.current = makeSnapshot(
          { ...form, status, publishedAt: newPublishedAt, contentRaw: content.contentRaw },
          content.contentRaw,
        )
        editorDirty.current = false
        setDirty(false)
        lastAutoSaveContent.current = content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot({
          ...form,
          status,
          publishedAt: newPublishedAt,
          contentRaw: content.contentRaw,
        })
        setAutoSaveTime(null)
        if (!postId) {
          const nextId = targetPostId ?? json.data.id
          pendingCreatedPostIdRef.current = null
          router.push(adminUrl(`/posts/${nextId}`))
        }
      } else {
        notify({ color: 'red', message: json.message || t('operationFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
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

  return (
    <div style={{ position: 'relative' }}>
      <EditorHeader
        entityId={postId}
        entityKey="post"
        entityLabel={t('entityLabel')}
        backUrl={adminUrl('/posts')}
        status={form.status}
        dirty={dirty}
        loading={loading}
        autoSaveTime={autoSaveTime}
        onPreview={handlePreview}
        onSaveDraft={handleSaveDraft}
        onPublish={handleSave}
        onDiscardDraft={async () => {
          const targetPostId = getTargetPostId()
          if (!targetPostId) return

          // 先删除草稿，再重新加载已发布内容
          await fetch(`/api/posts/${targetPostId}/draft`, { method: 'DELETE' })
          const res = await fetch(`/api/posts/${targetPostId}`)
          const json = await res.json()
          if (!json.success) return
          const postData = json.data
          const restoredForm: FormState = {
            title: postData.title,
            slug: postData.slug || '',
            contentRaw: postData.contentRaw,
            excerpt: postData.excerpt || '',
            status: postData.status,
            categoryId: postData.categoryId ? String(postData.categoryId) : '',
            tagNames: postData.tagNames || [],
            allowComment: postData.allowComment,
            showComments: postData.showComments,
            pinned: postData.pinned,
            coverImage: postData.coverImage || '',
            publishedAt: postData.publishedAt,
            seoTitle: postData.seoTitle || '',
            seoDescription: postData.seoDescription || '',
          }
          const restoreCT = (postData.contentType || 'richtext') as ContentType
          setForm(restoredForm)
          setContentType(restoreCT)
          contentTypeRef.current = restoreCT
          setPublishTab(
            postData.status === 'published'
              ? 'published'
              : postData.status === 'scheduled'
                ? 'scheduled'
                : 'draft',
          )
          setScheduledTime(
            postData.publishedAt && postData.status === 'scheduled' ? postData.publishedAt : null,
          )
          if (restoreCT === 'richtext') {
            const ed = getEditor()
            if (ed) ed.commands.setContent(postData.contentHtml)
          }
          setTextContent(postData.contentRaw)
          lastAutoSaveContent.current = postData.contentRaw
          lastAutoSaveMetaRef.current = getMetaSnapshot(restoredForm)
          textContentRef.current = postData.contentRaw
          savedSnapshot.current = makeSnapshot(restoredForm, postData.contentRaw)
          editorDirty.current = false
          setDirty(false)
          setAutoSaveTime(null)
        }}
      />

      <Grid>
        {/* 主编辑区 */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <TextInput
              label={t('fields.title')}
              placeholder={t('fields.titlePlaceholder')}
              size="lg"
              data-role="post-title-input"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />

            <TextInput
              label={t('fields.slug')}
              placeholder={t('fields.slugPlaceholder')}
              data-role="post-slug-input"
              value={form.slug}
              onChange={(e) => setField('slug', e.target.value)}
              error={
                form.slug.startsWith('-')
                  ? t('fields.slugStartsWithHyphen')
                  : form.slug.endsWith('-')
                    ? t('fields.slugEndsWithHyphen')
                    : undefined
              }
            />

            <Group>
              <ContentTypeSelector
                value={contentType}
                onChange={async (newType) => {
                  if (newType === contentType) return
                  const warning = t('contentSwitchWarning')
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
                  const targetPostId = getTargetPostId()
                  if (targetPostId) {
                    fetch(`/api/posts/${targetPostId}/draft`, {
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
              placeholder={t('fields.contentPlaceholder')}
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
                label={
                  contentType === 'markdown' ? t('fields.markdownContent') : t('fields.htmlContent')
                }
                placeholder={
                  contentType === 'markdown'
                    ? t('fields.markdownPlaceholder')
                    : t('fields.htmlPlaceholder')
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
              label={t('fields.excerpt')}
              placeholder={t('fields.excerptPlaceholder')}
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
            <PublishSettings
              currentStatus={form.status}
              publishTab={publishTab}
              onPublishTabChange={setPublishTab}
              scheduledTime={scheduledTime}
              onScheduledTimeChange={setScheduledTime}
              publishedAt={form.publishedAt}
              dirty={dirty}
              loading={loading}
              onConvertToDraft={async () => {
                setScheduledTime(null)
                await handleSave('draft', { publishedAt: null })
              }}
              onSetScheduled={async (publishedAt) => {
                const isPast = new Date(publishedAt) <= new Date()
                await handleSave(isPast ? 'published' : 'scheduled', { publishedAt })
              }}
              entityLabel={t('entityLabel')}
            />

            {postId && (
              <Paper withBorder p="md">
                <Button
                  variant="subtle"
                  fullWidth
                  onClick={() => setHistoryOpen(true)}
                  data-role="post-editor-history-button"
                >
                  {t('historyButton')}
                </Button>
              </Paper>
            )}

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                {t('sections.settings')}
              </Text>
              <TextInput
                label={t('fields.coverImage')}
                placeholder={t('fields.coverImagePlaceholder')}
                value={form.coverImage}
                onChange={(e) => setField('coverImage', e.target.value)}
              />
              <Checkbox
                label={t('fields.pinned')}
                mt="sm"
                checked={form.pinned}
                onChange={(e) => setField('pinned', e.currentTarget.checked)}
              />
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                {t('sections.taxonomy')}
              </Text>
              <Select
                label={t('fields.category')}
                placeholder={t('fields.categoryPlaceholder')}
                clearable
                searchable
                data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                value={form.categoryId}
                onChange={(v) => setField('categoryId', v || '')}
              />

              <TagsInput
                label={t('fields.tags')}
                placeholder={t('fields.tagsPlaceholder')}
                mt="sm"
                data={allTags.map((t) => t.name)}
                value={form.tagNames}
                onChange={(v) => setField('tagNames', v)}
              />
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                {t('sections.comments')}
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
                    ? t('comments.globalDisabledBoth')
                    : globalCommentOff
                      ? t('comments.globalDisabledComment')
                      : t('comments.globalDisabledList')}
                </Alert>
              )}
              <Checkbox
                label={t('comments.showComments')}
                checked={form.showComments}
                onChange={(e) => setField('showComments', e.currentTarget.checked)}
              />
              <Checkbox
                label={t('comments.allowComments')}
                mt="xs"
                checked={form.allowComment}
                disabled={!form.showComments}
                onChange={(e) => setField('allowComment', e.currentTarget.checked)}
              />
            </Paper>

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                {t('sections.seo')}
              </Text>
              <TextInput
                label={t('fields.seoTitle')}
                placeholder={t('fields.optionalPlaceholder')}
                value={form.seoTitle}
                onChange={(e) => setField('seoTitle', e.target.value)}
              />
              <Textarea
                label={t('fields.seoDescription')}
                placeholder={t('fields.optionalPlaceholder')}
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
