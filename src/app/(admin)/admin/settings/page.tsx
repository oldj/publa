'use client'

import { useCurrentUser } from '@/app/(admin)/_components/AdminCountsContext'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import { PageHeader } from '@/app/(admin)/_components/PageHeader'
import CodeEditor from '@/components/editors/CodeEditor'
import { isLocale, LOCALE_LABELS, SUPPORTED_LOCALES } from '@/i18n/locales'
import { notify } from '@/lib/notify'
import {
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
import { IconExclamationMark } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'

interface FaviconState {
  mode: 'default' | 'url' | 'upload'
  url: string
  mimeType: string
  version: string
  previewUrl: string
}

const DEFAULT_FAVICON: FaviconState = {
  mode: 'default',
  url: '',
  mimeType: '',
  version: '',
  previewUrl: '/favicon.ico?v=default',
}

export default function SettingsPage() {
  const t = useTranslations('admin.settingsPage')
  const tLang = useTranslations('admin.settings.languageField')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const currentUser = useCurrentUser()
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const initialSettingsRef = useRef<Record<string, unknown>>({})
  const [favicon, setFavicon] = useState<FaviconState>(DEFAULT_FAVICON)
  const [faviconUrlInput, setFaviconUrlInput] = useState('')
  const [faviconAction, setFaviconAction] = useState<'url' | 'upload' | 'reset' | null>(null)
  const [loading, setLoading] = useState(false)

  const applyFaviconState = useCallback((nextFavicon: FaviconState) => {
    setFavicon(nextFavicon)
    setFaviconUrlInput(nextFavicon.url || '')
  }, [])

  const fetchSettings = useCallback(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSettings(json.data)
          initialSettingsRef.current = json.data
        }
      })
  }, [])

  const fetchFavicon = useCallback(() => {
    fetch('/api/settings/favicon')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) applyFaviconState(json.data)
      })
  }, [applyFaviconState])

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return

    fetchSettings()
    fetchFavicon()
  }, [currentUser, fetchFavicon, fetchSettings])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const setField = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const restoreScrollPositionSoon = (x: number, y: number) => {
    const restore = () => window.scrollTo(x, y)

    // router.refresh() 的 RSC 更新时序不完全固定，短时间多次恢复避免被后续重绘覆盖。
    window.requestAnimationFrame(() => {
      restore()
      window.requestAnimationFrame(restore)
    })
    window.setTimeout(restore, 50)
    window.setTimeout(restore, 150)
  }

  const handleSave = async () => {
    const previousLanguage = initialSettingsRef.current.language
    const nextSettings = { ...settings }
    const shouldRefreshLocale = nextSettings.language !== previousLanguage

    // 检查 customHeadHtml 中是否存在不支持的标签
    const headHtml = String(settings.customHeadHtml ?? '')
    if (headHtml) {
      const supportedTags = new Set(['script', 'meta', 'link', 'style'])
      const allTags = headHtml.match(/<([a-zA-Z][\w-]*)/g) || []
      const unsupported = allTags
        .map((t) => t.slice(1))
        .filter((name) => !supportedTags.has(name.toLowerCase()))
      if (unsupported.length > 0) {
        const names = [...new Set(unsupported)].join('、')
        notify({
          color: 'yellow',
          icon: <IconExclamationMark />,
          message: t('messages.unsupportedHeadTags', { names }),
        })
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: tCommon('save.success') })
        initialSettingsRef.current = nextSettings
        if (shouldRefreshLocale) {
          const scrollX = window.scrollX
          const scrollY = window.scrollY

          // 仅语言变化时刷新 RSC，让根布局重新解析 locale；普通保存无需刷新页面。
          router.refresh()
          restoreScrollPositionSoon(scrollX, scrollY)
        }
      } else {
        notify({ color: 'red', message: json.message || tCommon('save.failed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFaviconUrl = async () => {
    setFaviconAction('url')
    try {
      const res = await fetch('/api/settings/favicon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: faviconUrlInput }),
      })
      const json = await res.json()
      if (json.success) {
        applyFaviconState(json.data)
        notify({ color: 'green', message: t('messages.faviconUpdated') })
      } else {
        notify({ color: 'red', message: json.message || tCommon('save.failed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setFaviconAction(null)
    }
  }

  const handleUploadFavicon = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setFaviconAction('upload')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/settings/favicon', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        applyFaviconState(json.data)
        notify({ color: 'green', message: t('messages.faviconUploaded') })
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.uploadFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setFaviconAction(null)
    }
  }

  const handleResetFavicon = async () => {
    setFaviconAction('reset')
    try {
      const res = await fetch('/api/settings/favicon', {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        applyFaviconState(json.data)
        notify({ color: 'green', message: t('messages.faviconReset') })
      } else {
        notify({ color: 'red', message: json.message || tCommon('errors.operationFailed') })
      }
    } catch {
      notify({ color: 'red', message: tCommon('errors.network') })
    } finally {
      setFaviconAction(null)
    }
  }

  const isDirty = Object.keys(settings).some(
    (key) =>
      JSON.stringify(settings[key]) !== JSON.stringify(initialSettingsRef.current[key] ?? ''),
  )

  const faviconModeLabel =
    favicon.mode === 'upload'
      ? t('modes.upload')
      : favicon.mode === 'url'
        ? t('modes.url')
        : t('modes.default')

  return (
    <Box>
      <PageHeader title={t('title')} dirty={isDirty} loading={loading} onSave={handleSave} />

      <Stack>
        <Divider label={t('sections.siteInfo')} labelPosition="left" />
        <Select
          label={tLang('label')}
          description={tLang('description')}
          value={isLocale(settings.language) ? settings.language : 'en'}
          onChange={(v) => {
            if (v) setField('language', v)
          }}
          data={SUPPORTED_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
          allowDeselect={false}
          styles={{ wrapper: { maxWidth: 240 } }}
        />
        <TextInput
          label={t('fields.siteTitle')}
          placeholder="Publa"
          value={String(settings.siteTitle ?? '')}
          onChange={(e) => setField('siteTitle', e.target.value)}
        />
        <TextInput
          label={t('fields.siteSlogan')}
          placeholder="Yet Another Amazing Blog"
          value={String(settings.siteSlogan ?? '')}
          onChange={(e) => setField('siteSlogan', e.target.value)}
        />
        <TextInput
          label={t('fields.siteDescription')}
          value={String(settings.siteDescription ?? '')}
          onChange={(e) => setField('siteDescription', e.target.value)}
        />
        <TextInput
          label={t('fields.siteUrl')}
          description={t('fields.siteUrlDescription')}
          placeholder="https://example.com"
          value={String(settings.siteUrl ?? '')}
          onChange={(e) => setField('siteUrl', e.target.value)}
        />

        <Divider label={t('sections.favicon')} labelPosition="left" mt="md" />
        <Group align="flex-start" wrap="nowrap">
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              {t('fields.currentPreview')}
            </Text>
            <div
              style={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--mantine-color-gray-3)',
                background: '#fff',
              }}
            >
              <img
                src={favicon.previewUrl}
                alt={t('fields.siteIconPreviewAlt')}
                width={32}
                height={32}
                style={{ display: 'block' }}
              />
            </div>
            <Text size="xs" c="dimmed">
              {t('fields.currentMode', { mode: faviconModeLabel })}
            </Text>
          </Stack>

          <Stack gap="xs" style={{ flex: 1 }}>
            <TextInput
              label={t('fields.faviconUrl')}
              description={t('fields.faviconUrlDescription')}
              placeholder="https://example.com/favicon.png"
              value={faviconUrlInput}
              onChange={(e) => setFaviconUrlInput(e.target.value)}
            />
            <Group>
              <Button
                variant="light"
                onClick={handleApplyFaviconUrl}
                loading={faviconAction === 'url'}
                disabled={faviconAction !== null && faviconAction !== 'url'}
              >
                {t('fields.applyUrl')}
              </Button>
              <Button
                component="label"
                variant="default"
                loading={faviconAction === 'upload'}
                disabled={faviconAction !== null && faviconAction !== 'upload'}
              >
                {t('fields.uploadIcon')}
                <input
                  hidden
                  type="file"
                  accept=".ico,image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml,image/webp"
                  onChange={handleUploadFavicon}
                />
              </Button>
              <Button
                variant="subtle"
                color="gray"
                onClick={handleResetFavicon}
                loading={faviconAction === 'reset'}
                disabled={faviconAction !== null && faviconAction !== 'reset'}
              >
                {t('fields.resetDefault')}
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              {t('fields.faviconHelp')}
            </Text>
          </Stack>
        </Group>

        <Divider label={t('sections.comments')} labelPosition="left" mt="md" />
        <Switch
          label={t('fields.showCommentsGlobally')}
          description={t('fields.showCommentsGloballyDescription')}
          checked={settings.showCommentsGlobally === true}
          onChange={(e) => setField('showCommentsGlobally', e.currentTarget.checked)}
        />
        <Switch
          label={t('fields.enableComment')}
          description={t('fields.enableCommentDescription')}
          checked={settings.enableComment === true}
          disabled={settings.showCommentsGlobally === false}
          onChange={(e) => setField('enableComment', e.currentTarget.checked)}
        />
        <Switch
          label={t('fields.defaultApprove')}
          checked={settings.defaultApprove === true}
          onChange={(e) => setField('defaultApprove', e.currentTarget.checked)}
        />

        <Divider label={t('sections.guestbook')} labelPosition="left" mt="md" />
        <Switch
          label={t('fields.enableGuestbook')}
          description={<>{t('fields.enableGuestbookDescription')}</>}
          checked={settings.enableGuestbook === true}
          onChange={(e) => setField('enableGuestbook', e.currentTarget.checked)}
        />
        <TextInput
          label={t('fields.guestbookWelcome')}
          placeholder={t('fields.guestbookWelcomePlaceholder')}
          value={String(settings.guestbookWelcome ?? '')}
          onChange={(e) => setField('guestbookWelcome', e.target.value)}
        />

        <Divider label={t('sections.rss')} labelPosition="left" mt="md" />
        <Radio.Group
          label={t('fields.rssContent')}
          value={String(settings.rssContent ?? 'full')}
          onChange={(v) => setField('rssContent', v)}
        >
          <Group mt="xs">
            <Radio value="full" label={t('fields.rssFull')} />
            <Radio value="excerpt" label={t('fields.rssExcerpt')} />
          </Group>
        </Radio.Group>
        <NumberInput
          label={t('fields.rssLimit')}
          min={1}
          max={100}
          value={Number(settings.rssLimit) || 10}
          onChange={(v) => setField('rssLimit', Number(v) || 10)}
          style={{ width: 120 }}
        />

        <Divider label={t('sections.search')} labelPosition="left" mt="md" />
        <Switch
          label={t('fields.enableSearch')}
          description={t('fields.enableSearchDescription')}
          checked={settings.enableSearch === true}
          onChange={(e) => setField('enableSearch', e.currentTarget.checked)}
        />

        <Divider label={t('sections.footer')} labelPosition="left" mt="md" />
        <CodeEditor
          language="html"
          label={t('fields.footerCopyright')}
          description={t('fields.footerCopyrightDescription')}
          placeholder="{SITE_NAME} &copy; {FULL_YEAR}"
          height="120px"
          value={String(settings.footerCopyright ?? '')}
          onChange={(next) => setField('footerCopyright', next)}
        />

        <Divider label={t('sections.customHtml')} labelPosition="left" mt="md" />
        <Tabs defaultValue="head">
          <Tabs.List>
            <Tabs.Tab value="head">{t('customHtmlTabs.head')}</Tabs.Tab>
            <Tabs.Tab value="bodyStart">{t('customHtmlTabs.bodyStart')}</Tabs.Tab>
            <Tabs.Tab value="bodyEnd">{t('customHtmlTabs.bodyEnd')}</Tabs.Tab>
            <Tabs.Tab value="afterPost">{t('customHtmlTabs.afterPost')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="head" pt="sm">
            <CodeEditor
              language="html"
              description={t('fields.customHeadHtmlDescription')}
              placeholder="<script>...</script>"
              height="480px"
              value={String(settings.customHeadHtml ?? '')}
              onChange={(next) => setField('customHeadHtml', next)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="bodyStart" pt="sm">
            <CodeEditor
              language="html"
              description={t('fields.customBodyStartHtmlDescription')}
              placeholder="<script>...</script>"
              height="480px"
              value={String(settings.customBodyStartHtml ?? '')}
              onChange={(next) => setField('customBodyStartHtml', next)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="bodyEnd" pt="sm">
            <CodeEditor
              language="html"
              description={t('fields.customBodyEndHtmlDescription')}
              placeholder="<script>...</script>"
              height="480px"
              value={String(settings.customBodyEndHtml ?? '')}
              onChange={(next) => setField('customBodyEndHtml', next)}
            />
          </Tabs.Panel>

          <Tabs.Panel value="afterPost" pt="sm">
            <CodeEditor
              language="html"
              description={t('fields.customAfterPostHtmlDescription')}
              placeholder="<div>...</div>"
              height="480px"
              value={String(settings.customAfterPostHtml ?? '')}
              onChange={(next) => setField('customAfterPostHtml', next)}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Box>
  )
}
