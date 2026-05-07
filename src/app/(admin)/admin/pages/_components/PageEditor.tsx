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
import CodeEditor from '@/components/editors/CodeEditor'
import ContentTypeSelector from '@/components/editors/ContentTypeSelector'
import RichTextEditorWrapper, {
  type RichTextEditorHandle,
} from '@/components/editors/RichTextEditorWrapper'
import { getClientErrorMessage } from '@/lib/client-error'
import { notify } from '@/lib/notify'
import {
  Alert,
  Button,
  Grid,
  Group,
  Menu,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { shouldCreateDraftRecord } from '../../_lib/draft-persistence'
import {
  AUTO_SAVE_INTERVAL,
  NEW_DOC_POLL_INTERVAL_MS,
  useAutoSavePhase,
} from '../../_lib/use-auto-save-phase'
import { type LocalDraftBackup, useLocalDraftBackup } from '../../_lib/use-local-draft-backup'
import RevisionHistory from '../../posts/_components/RevisionHistory'
import { buildPageDraftPayload, buildPageSaveBody } from './page-save-payload'

const AUTO_SAVE_FAIL_ID = 'auto-save-fail'

interface PageDraftContent {
  title: string
  path: string
  template: string
  mimeType: string
  seoTitle: string
  seoDescription: string
  publishedAt: string | null
  contentType: ContentType
  contentRaw: string
  contentHtml: string
  updatedAt: string
}

function createEmptyPageForm() {
  return {
    title: '',
    path: '',
    template: 'default',
    mimeType: '',
    status: 'draft',
    publishedAt: null as string | null,
    seoTitle: '',
    seoDescription: '',
  }
}

export default function PageEditor({ pageId }: { pageId?: number }) {
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const t = useTranslations('admin.editor.page')
  const tCommon = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const savedSnapshot = useRef<string>('')
  const editorDirty = useRef(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 发布设置面板
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)
  const [publishTab, setPublishTab] = useState<string>('draft')
  const lastAutoSaveContent = useRef<string>('')
  const lastAutoSaveMetaRef = useRef<string>('')
  const creatingRef = useRef(false)
  const pendingCreatedPageIdRef = useRef<number | null>(null)
  const skipInitialLoadForCreatedPageIdRef = useRef<number | null>(null)
  const routePageIdRef = useRef<number | undefined>(pageId)

  const validatePath = useCallback(
    (path: string): string | null => {
      if (!path) return t('pathRequired')
      if (path.startsWith('/')) return t('pathStartsWithSlash')
      if (path.endsWith('/')) return t('pathEndsWithSlash')
      return null
    },
    [t],
  )

  // 自动保存状态机
  const { autoSavePhaseRef, onAutoSaveFail, clearAutoSaveFail } = useAutoSavePhase({
    notificationId: AUTO_SAVE_FAIL_ID,
    failMessage: t('autoSaveFailed'),
  })
  const autoSavingRef = useRef(false)

  // 本地草稿备份（localStorage）
  type PageFormState = ReturnType<typeof createEmptyPageForm>
  const [pendingBackup, setPendingBackup] = useState<LocalDraftBackup<PageFormState> | null>(null)
  const backupReadyRef = useRef(true)
  const [contentType, setContentType] = useState<ContentType>('richtext')
  const contentTypeRef = useRef<ContentType>('richtext')
  const [textContent, setTextContent] = useState('')
  const textContentRef = useRef('')
  const richTextRef = useRef<RichTextEditorHandle>(null)
  // 编辑器就绪前暂存待加载的 HTML 内容
  const pendingEditorContent = useRef<string | null>(null)
  const [form, setForm] = useState(createEmptyPageForm)
  const formRef = useRef(form)

  type FormState = typeof form

  // 生成元数据快照，用于自动保存变更检测
  const getMetaSnapshot = useCallback(
    (f: FormState) =>
      JSON.stringify({
        title: f.title,
        path: f.path,
        template: f.template,
        mimeType: f.mimeType,
        publishedAt: f.publishedAt,
        seoTitle: f.seoTitle,
        seoDescription: f.seoDescription,
      }),
    [],
  )

  // 生成完整快照，用于已修改状态判定
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

  const getEditor = useCallback(() => richTextRef.current?.getEditor() ?? null, [])

  const resetEditorState = useCallback(
    ({ keepLoading = false }: { keepLoading?: boolean } = {}) => {
      const nextForm = createEmptyPageForm()
      const editor = getEditor()

      if (editor) {
        editor.commands.setContent('')
      }

      pendingEditorContent.current = null
      setForm(nextForm)
      formRef.current = nextForm
      setPathError(null)
      setContentType('richtext')
      contentTypeRef.current = 'richtext'
      setTextContent('')
      textContentRef.current = ''
      lastAutoSaveContent.current = ''
      lastAutoSaveMetaRef.current = getMetaSnapshot(nextForm)
      savedSnapshot.current = makeSnapshot(nextForm, '')
      editorDirty.current = false
      pendingCreatedPageIdRef.current = null
      skipInitialLoadForCreatedPageIdRef.current = null
      creatingRef.current = false
      setDirty(false)
      setLastSavedAt(null)
      setScheduledTime(null)
      setPublishTab('draft')
      setHistoryOpen(false)
      setLoading(keepLoading)
      clearAutoSaveFail()
    },
    [clearAutoSaveFail, getEditor, getMetaSnapshot, makeSnapshot],
  )

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      setDirty(checkDirty(next, textContent) || editorDirty.current)
      return next
    })
  }

  // 图片上传
  const storageConfigured = useRef<boolean | null>(null)
  const checkStorageConfig = useCallback(async () => {
    if (storageConfigured.current !== null) return storageConfigured.current
    try {
      const res = await fetch('/api/attachments/config')
      const json = await res.json()
      const configured = !!json.data?.storageProvider
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
        if (!json.success) throw new Error(json.message || t('uploadFailed'))
        return json.data.publicUrl
      } catch (error) {
        const message = getClientErrorMessage(error, {
          networkMessage: tCommon('errors.network'),
          fallbackMessage: t('uploadFailed'),
        })
        throw new Error(message)
      }
    },
    [t, tCommon],
  )

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

  const getBackupSnapshot = useCallback(() => {
    if (!backupReadyRef.current) return null
    const content = getCurrentContent()
    return {
      form: formRef.current,
      content: {
        contentType: content.contentType,
        contentRaw: content.contentRaw,
        contentHtml: content.contentHtml,
      },
    }
  }, [getCurrentContent])

  const { readBackup, discardBackup } = useLocalDraftBackup<PageFormState>({
    type: 'page',
    id: pageId ?? null,
    getSnapshot: getBackupSnapshot,
  })

  // 加载页面数据（编辑模式）
  useEffect(() => {
    const previousPageId = routePageIdRef.current
    routePageIdRef.current = pageId

    if (skipInitialLoadForCreatedPageIdRef.current === pageId) {
      skipInitialLoadForCreatedPageIdRef.current = null
      pendingCreatedPageIdRef.current = null
      backupReadyRef.current = true
      setPendingBackup(null)
      setLoading(false)
      return
    }

    if (!pageId) {
      resetEditorState()
      backupReadyRef.current = true
      setPendingBackup(null)
      return
    }

    if (previousPageId !== undefined && previousPageId !== pageId) {
      resetEditorState({ keepLoading: true })
    } else {
      setLoading(true)
    }

    // 加载期间暂停备份写入，避免空表单或云端内容覆盖已有本地备份
    backupReadyRef.current = false
    setPendingBackup(null)

    const controller = new AbortController()
    let active = true

    fetch(`/api/pages/${pageId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!active) return

        if (json.success) {
          const p = json.data
          const draft = p.draftContent as PageDraftContent | null
          const contentRaw = draft ? draft.contentRaw : p.contentRaw
          const contentHtml = draft ? draft.contentHtml : p.contentHtml
          const initialPath = draft ? draft.path : p.path || ''

          const initialPublishedAt = draft?.publishedAt ?? p.publishedAt ?? null
          setForm({
            title: draft ? draft.title : p.title,
            path: initialPath,
            template: draft ? draft.template : p.template,
            mimeType: draft ? draft.mimeType : p.mimeType || '',
            status: p.status,
            publishedAt: initialPublishedAt,
            seoTitle: draft ? draft.seoTitle : p.seoTitle || '',
            seoDescription: draft ? draft.seoDescription : p.seoDescription || '',
          })
          setPathError(initialPath ? validatePath(initialPath) : null)
          setPublishTab(
            p.status === 'published'
              ? 'published'
              : p.status === 'scheduled'
                ? 'scheduled'
                : 'draft',
          )
          if (p.status === 'scheduled' && p.publishedAt) {
            setScheduledTime(p.publishedAt)
          } else {
            setScheduledTime(null)
          }

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
            mimeType: draft ? draft.mimeType : p.mimeType || '',
            status: p.status,
            publishedAt: initialPublishedAt,
            seoTitle: draft ? draft.seoTitle : p.seoTitle || '',
            seoDescription: draft ? draft.seoDescription : p.seoDescription || '',
          })
          if (draft) {
            setLastSavedAt(draft.updatedAt)
          }

          // 保存初始快照，用于已修改状态判定
          const nextForm = {
            title: draft ? draft.title : p.title,
            path: initialPath,
            template: draft ? draft.template : p.template,
            mimeType: draft ? draft.mimeType : p.mimeType || '',
            status: p.status,
            publishedAt: initialPublishedAt,
            seoTitle: draft ? draft.seoTitle : p.seoTitle || '',
            seoDescription: draft ? draft.seoDescription : p.seoDescription || '',
          }
          savedSnapshot.current = makeSnapshot(nextForm, contentRaw)
          editorDirty.current = false
          // 有未发布的草稿时显示「已修改」
          setDirty(!!draft)

          // 对比本地备份：正文或任一 draft 元数据与云端不一致则提示恢复，
          // 否则说明本地备份已被云端覆盖，静默清掉。
          // 用 getMetaSnapshot 比较：只包含 draft 相关字段，与 autosave 的变更检测同源
          const backup = readBackup()
          if (backup) {
            const backupMatchesCloud =
              backup.content.contentRaw === contentRaw &&
              backup.content.contentType === ct &&
              getMetaSnapshot(backup.form) === getMetaSnapshot(nextForm)
            if (backupMatchesCloud) {
              discardBackup()
              backupReadyRef.current = true
              setPendingBackup(null)
            } else {
              setPendingBackup(backup)
            }
          } else {
            backupReadyRef.current = true
            setPendingBackup(null)
          }
        } else {
          // 服务端返回 { success: false }（未登录、权限不足等）：不强制跳转，
          // 但恢复写入开关，避免 writer 永久停摆
          backupReadyRef.current = true
          setPendingBackup(null)
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof Error && error.name === 'AbortError') return

        backupReadyRef.current = true
        setPendingBackup(null)
        notify({ color: 'red', message: t('loadFailed') })
        router.push(adminUrl('/pages'))
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
  }, [
    pageId,
    adminUrl,
    router,
    getMetaSnapshot,
    makeSnapshot,
    resetEditorState,
    t,
    validatePath,
    readBackup,
    discardBackup,
  ])

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

  const applyBackupRestore = useCallback(
    (backup: LocalDraftBackup<PageFormState>) => {
      const nextForm = backup.form
      const nextContent = backup.content
      const ct = nextContent.contentType

      setForm(nextForm)
      formRef.current = nextForm
      setPathError(nextForm.path ? validatePath(nextForm.path) : null)
      setContentType(ct)
      contentTypeRef.current = ct

      if (ct === 'richtext') {
        const html = nextContent.contentHtml ?? nextContent.contentRaw
        const ed = richTextRef.current?.getEditor()
        if (ed) {
          ed.commands.setContent(html)
        } else {
          pendingEditorContent.current = html
        }
      }
      setTextContent(nextContent.contentRaw)
      textContentRef.current = nextContent.contentRaw

      lastAutoSaveContent.current = ''
      lastAutoSaveMetaRef.current = ''
      editorDirty.current = true
      setDirty(true)

      backupReadyRef.current = true
      setPendingBackup(null)
    },
    [validatePath],
  )

  const ignorePendingBackup = useCallback(() => {
    discardBackup()
    backupReadyRef.current = true
    setPendingBackup(null)
  }, [discardBackup])

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

  const ensurePendingPageId = useCallback(
    async (silent = false) => {
      if (pendingCreatedPageIdRef.current) return pendingCreatedPageIdRef.current

      const res = await fetch('/api/pages', {
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

      pendingCreatedPageIdRef.current = json.data.id
      return json.data.id as number
    },
    [t],
  )

  const getTargetPageId = useCallback(() => pageId ?? pendingCreatedPageIdRef.current, [pageId])

  // 创建空草稿并保存完整草稿快照后跳转到真实编辑页
  const createAndRedirect = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const targetPageId = getTargetPageId()
      if (targetPageId) return targetPageId
      if (creatingRef.current) return pendingCreatedPageIdRef.current

      creatingRef.current = true

      try {
        const newId = await ensurePendingPageId(silent)
        if (!newId) {
          if (silent) onAutoSaveFail()
          return null
        }
        const formState = formRef.current
        const content = getCurrentContent()

        // 保存完整草稿快照，允许 path 暂时非法或重复
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
        pendingCreatedPageIdRef.current = newId
        lastAutoSaveContent.current = content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        textContentRef.current = content.contentRaw
        setTextContent(content.contentRaw)
        savedSnapshot.current = makeSnapshot(formState, content.contentRaw)
        setLastSavedAt(draftSave.json.data.updatedAt)
        setDirty(true)
        skipInitialLoadForCreatedPageIdRef.current = newId
        router.replace(adminUrl(`/pages/${newId}`))
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
      getTargetPageId,
      ensurePendingPageId,
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

  // 自动保存定时器（递归 setTimeout，间隔随 phase 动态变化）
  useEffect(() => {
    let cancelled = false

    function scheduleNext() {
      if (cancelled) return
      // 新文档阶段用固定 5s 轮询，避免初次等满一个 phase 间隔（30s）才触发首次落库
      const delay = getTargetPageId()
        ? AUTO_SAVE_INTERVAL[autoSavePhaseRef.current]
        : NEW_DOC_POLL_INTERVAL_MS
      setTimeout(tick, delay)
    }

    function tick() {
      if (cancelled) return
      if (autoSavingRef.current) {
        scheduleNext()
        return
      }

      const content = getCurrentContent()
      const targetPageId = getTargetPageId()

      // 新页面：首次有实际内容时创建记录并跳转到真实编辑页；
      // 此阶段用固定 5s 轮询（不受 phase 影响），避免用户起草时等一整个 30s 才落库
      if (!targetPageId) {
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
        scheduleNext()
        return
      }

      const currentMeta = getMetaSnapshot(formRef.current)
      // 故意跳过空内容：避免误操作清空后立即把空草稿同步到云端；元数据变化仍会照常保存
      const contentChanged =
        content.contentRaw && content.contentRaw !== lastAutoSaveContent.current
      const metaChanged = currentMeta !== lastAutoSaveMetaRef.current
      if (!contentChanged && !metaChanged) {
        scheduleNext()
        return
      }

      autoSavingRef.current = true
      saveDraftRevision(targetPageId, formRef.current, content)
        .then(({ json }) => {
          if (json.success) {
            clearAutoSaveFail()
            lastAutoSaveContent.current = content.contentRaw
            lastAutoSaveMetaRef.current = currentMeta
            setLastSavedAt(json.data.updatedAt)
            // 云端已吸收最新内容，清掉本地兜底备份
            discardBackup()
          } else {
            onAutoSaveFail()
          }
        })
        .catch(() => {
          onAutoSaveFail()
        })
        .finally(() => {
          autoSavingRef.current = false
          scheduleNext()
        })
    }

    scheduleNext()

    return () => {
      cancelled = true
    }
  }, [
    getTargetPageId,
    createAndRedirect,
    getCurrentContent,
    getMetaSnapshot,
    saveDraftRevision,
    clearAutoSaveFail,
    onAutoSaveFail,
    discardBackup,
  ])

  const handlePathChange = (value: string) => {
    setField('path', value)
    setPathError(validatePath(value))
  }

  // 预览：先保存草稿，再在新窗口打开预览
  const handlePreview = async () => {
    const targetPageId = getTargetPageId()
    if (!targetPageId) {
      await createAndRedirect()
      return
    }

    setLoading(true)
    try {
      const formState = formRef.current
      const draftSave = await saveDraftRevision(targetPageId, formState)
      if (draftSave.json.success) {
        lastAutoSaveContent.current = draftSave.content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        setLastSavedAt(draftSave.json.data.updatedAt)
        discardBackup()
        window.open(`/--preview-${targetPageId}`, '_blank')
      } else {
        notify({ color: 'red', message: draftSave.json.message || tCommon('errors.saveFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  // 手动保存草稿：仅保存完整草稿快照，不阻塞于 path 校验
  const handleSaveDraft = async () => {
    const targetPageId = getTargetPageId()
    if (!targetPageId) {
      await createAndRedirect()
      return
    }

    setLoading(true)
    try {
      const formState = formRef.current
      const draftSave = await saveDraftRevision(targetPageId, formState)
      if (draftSave.json.success) {
        clearAutoSaveFail()
        lastAutoSaveContent.current = draftSave.content.contentRaw
        lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
        setLastSavedAt(draftSave.json.data.updatedAt)
        discardBackup()
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

  const handleSave = async (saveStatus?: string, overrides?: { publishedAt?: string | null }) => {
    const status = saveStatus || 'published'

    // 发布/定时发布时校验必填字段
    if (status !== 'draft') {
      if (!form.title) {
        notify({ color: 'red', message: t('titleRequired') })
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
      const targetPageId = getTargetPageId()
      const url = targetPageId ? `/api/pages/${targetPageId}` : '/api/pages'
      const method = targetPageId ? 'PUT' : 'POST'

      const body = buildPageSaveBody(form, content, status, {
        ...overrides,
        now: new Date().toISOString(),
      })

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        clearAutoSaveFail()
        discardBackup()
        if (!pageId) {
          const nextId = targetPageId ?? json.data.id
          pendingCreatedPageIdRef.current = null
          notify({ color: 'green', message: t('createSuccess') })
          router.push(adminUrl(`/pages/${nextId}`))
        } else {
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
            { ...form, status, publishedAt: newPublishedAt },
            content.contentRaw,
          )
          editorDirty.current = false
          setDirty(false)
          lastAutoSaveContent.current = content.contentRaw
          lastAutoSaveMetaRef.current = getMetaSnapshot({
            ...form,
            status,
            publishedAt: newPublishedAt,
          })
          setLastSavedAt(null)
        }
      } else {
        // 服务端路径校验错误回填到输入框
        if (json.code === 'INVALID_PATH' && json.message) {
          setPathError(json.message)
        }
        notify({ color: 'red', message: json.message || t('operationFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleContentTypeChange = async (newType: ContentType) => {
    if (newType === contentType) return
    const warning = t('contentSwitchWarning')
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
    setDirty(true)
    setLastSavedAt(null)

    // 立即落库，与 PostEditor 对齐；失败时下一次自动保存会兜底
    const targetPageId = getTargetPageId()
    if (targetPageId) {
      const formState = formRef.current
      const content = getCurrentContent()
      saveDraftRevision(targetPageId, formState, content)
        .then(({ json }) => {
          if (json.success) {
            lastAutoSaveContent.current = content.contentRaw
            lastAutoSaveMetaRef.current = getMetaSnapshot(formState)
            setLastSavedAt(json.data.updatedAt)
          }
        })
        .catch(() => {})
    }
  }

  const isEdit = !!pageId

  return (
    <div style={{ position: 'relative' }}>
      <EditorHeader
        entityId={pageId}
        entityKey="page"
        entityLabel={t('entityLabel')}
        backUrl={adminUrl('/pages')}
        status={form.status}
        dirty={dirty}
        loading={loading}
        lastSavedAt={lastSavedAt}
        onPreview={handlePreview}
        onSaveDraft={handleSaveDraft}
        onPublish={handleSave}
        onDiscardDraft={async () => {
          const targetPageId = getTargetPageId()
          if (!targetPageId) return

          // 先删除草稿，再重新加载已发布内容
          await fetch(`/api/pages/${targetPageId}/draft`, { method: 'DELETE' })
          const res = await fetch(`/api/pages/${targetPageId}`)
          const json = await res.json()
          if (!json.success) return
          const pageData = json.data
          const restoredForm: FormState = {
            title: pageData.title,
            path: pageData.path || '',
            template: pageData.template || 'default',
            mimeType: pageData.mimeType || '',
            status: pageData.status,
            publishedAt: pageData.publishedAt ?? null,
            seoTitle: pageData.seoTitle || '',
            seoDescription: pageData.seoDescription || '',
          }
          const restoreCT = (pageData.contentType || 'richtext') as ContentType
          setForm(restoredForm)
          setPathError(restoredForm.path ? validatePath(restoredForm.path) : null)
          setContentType(restoreCT)
          contentTypeRef.current = restoreCT
          if (restoreCT === 'richtext') {
            const ed = getEditor()
            if (ed) ed.commands.setContent(pageData.contentHtml)
          }
          setTextContent(pageData.contentRaw)
          textContentRef.current = pageData.contentRaw
          lastAutoSaveContent.current = pageData.contentRaw
          lastAutoSaveMetaRef.current = getMetaSnapshot(restoredForm)
          savedSnapshot.current = makeSnapshot(restoredForm, pageData.contentRaw)
          editorDirty.current = false
          setDirty(false)
          setLastSavedAt(null)
          setPublishTab(
            pageData.status === 'published'
              ? 'published'
              : pageData.status === 'scheduled'
                ? 'scheduled'
                : 'draft',
          )
          if (pageData.status === 'scheduled' && pageData.publishedAt) {
            setScheduledTime(pageData.publishedAt)
          } else {
            setScheduledTime(null)
          }
          discardBackup()
        }}
      />

      {pendingBackup && (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconAlertTriangle size={16} />}
          my="sm"
          data-role="local-backup-alert"
        >
          <Text size="sm" mb="xs">
            {t('localBackup.recoverBody', {
              minutes: Math.max(1, Math.round((Date.now() - pendingBackup.savedAt) / 60_000)),
            })}
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="filled"
              onClick={() => applyBackupRestore(pendingBackup)}
              data-role="local-backup-recover"
            >
              {t('localBackup.recoverBtn')}
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={ignorePendingBackup}
              data-role="local-backup-ignore"
            >
              {t('localBackup.ignoreBtn')}
            </Button>
          </Group>
        </Alert>
      )}

      <Grid>
        {/* 主编辑区 */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            <TextInput
              label={t('fields.title')}
              required
              data-role="page-title-input"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
            <TextInput
              label={t('fields.path')}
              required
              placeholder={isEdit ? undefined : t('fields.pathPlaceholder')}
              data-role="page-path-input"
              value={form.path}
              onChange={(e) => handlePathChange(e.target.value)}
              error={pathError}
            />

            <ContentTypeSelector value={contentType} onChange={handleContentTypeChange} />

            {/* 富文本编辑器 */}
            <RichTextEditorWrapper
              editorRef={richTextRef}
              placeholder={t('fields.contentPlaceholder')}
              onImageUpload={uploadImage}
              checkStorageConfig={checkStorageConfig}
              onSave={handleSaveDraft}
              saveLoading={loading}
              onUpdate={() => {
                editorDirty.current = true
                setDirty(true)
                setLastSavedAt(null)
              }}
              onReady={(editor) => {
                if (pendingEditorContent.current) {
                  editor.commands.setContent(pendingEditorContent.current)
                  pendingEditorContent.current = null
                }
              }}
              hidden={contentType !== 'richtext'}
            />

            {/* Markdown / HTML 源码编辑器（CodeMirror，带行号 + 语法高亮） */}
            {contentType !== 'richtext' && (
              <CodeEditor
                language={contentType === 'markdown' ? 'markdown' : 'html'}
                label={
                  contentType === 'markdown' ? t('fields.markdownContent') : t('fields.htmlContent')
                }
                placeholder={
                  contentType === 'markdown'
                    ? t('fields.markdownPlaceholder')
                    : t('fields.htmlPlaceholder')
                }
                value={textContent}
                onChange={(next) => {
                  setTextContent(next)
                  textContentRef.current = next
                  setDirty(checkDirty(form, next) || editorDirty.current)
                }}
              />
            )}
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

            {isEdit && (
              <Paper withBorder p="md">
                <Button
                  variant="subtle"
                  fullWidth
                  onClick={() => setHistoryOpen(true)}
                  data-role="page-editor-history-button"
                >
                  {t('historyButton')}
                </Button>
              </Paper>
            )}

            <Paper withBorder p="md">
              <Text fw={500} mb="sm">
                {t('sections.settings')}
              </Text>
              <Stack gap="sm">
                <Select
                  label={t('fields.template')}
                  data-role="page-template-input"
                  data={[
                    { value: 'default', label: t('fields.templateDefault') },
                    { value: 'blank', label: t('fields.templateBlank') },
                  ]}
                  value={form.template}
                  onChange={(v) => {
                    const t = v || 'default'
                    setField('template', t)
                    if (t !== 'blank') setField('mimeType', '')
                  }}
                />
                {form.template === 'blank' && (
                  <Menu position="bottom-start" withinPortal>
                    <Menu.Target>
                      <TextInput
                        label={t('fields.mimeType')}
                        placeholder="text/html"
                        value={form.mimeType}
                        onChange={(e) => setField('mimeType', e.target.value)}
                        styles={{ input: { cursor: 'text' } }}
                      />
                    </Menu.Target>
                    <Menu.Dropdown>
                      {[
                        'text/html',
                        'text/plain',
                        'text/css',
                        'text/xml',
                        'application/json',
                        'application/javascript',
                        'application/xml',
                      ].map((t) => (
                        <Menu.Item key={t} onClick={() => setField('mimeType', t)}>
                          {t}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Stack>
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
