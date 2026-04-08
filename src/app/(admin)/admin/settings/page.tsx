'use client'

import { notify } from '@/lib/notify'
import {
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Radio,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { IconExclamationMark } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useCurrentUser } from '../../_components/AdminCountsContext'
import { PageHeader } from '../../_components/PageHeader'

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
  const router = useRouter()
  const currentUser = useCurrentUser()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const initialSettingsRef = useRef<Record<string, string>>({})
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
      router.replace('/admin')
    }
  }, [currentUser, router])

  useEffect(() => {
    if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) return

    fetchSettings()
    fetchFavicon()
  }, [currentUser, fetchFavicon, fetchSettings])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const setField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    // 检查 customHeadHtml 中是否存在不支持的标签
    if (settings.customHeadHtml) {
      const supportedTags = new Set(['script', 'meta', 'link', 'style'])
      const allTags = settings.customHeadHtml.match(/<([a-zA-Z][\w-]*)/g) || []
      const unsupported = allTags
        .map((t) => t.slice(1))
        .filter((name) => !supportedTags.has(name.toLowerCase()))
      if (unsupported.length > 0) {
        const names = [...new Set(unsupported)].join('、')
        notify({
          color: 'yellow',
          icon: <IconExclamationMark />,
          message: `自定义 Head HTML 中包含不支持的标签：${names}，这些标签不会被渲染`,
        })
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (json.success) {
        notify({ color: 'green', message: '保存成功' })
        initialSettingsRef.current = { ...settings }
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
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
        notify({ color: 'green', message: '站点图标已更新' })
      } else {
        notify({ color: 'red', message: json.message || '保存失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
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
        notify({ color: 'green', message: '站点图标已上传' })
      } else {
        notify({ color: 'red', message: json.message || '上传失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
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
        notify({ color: 'green', message: '已恢复默认图标' })
      } else {
        notify({ color: 'red', message: json.message || '操作失败' })
      }
    } catch {
      notify({ color: 'red', message: '网络错误' })
    } finally {
      setFaviconAction(null)
    }
  }

  const isDirty = Object.keys(settings).some(
    (key) => settings[key] !== (initialSettingsRef.current[key] ?? ''),
  )

  const faviconModeLabel =
    favicon.mode === 'upload' ? '已上传文件' : favicon.mode === 'url' ? '外链 URL' : '默认图标'

  return (
    <Box>
      <PageHeader title="系统设置" dirty={isDirty} loading={loading} onSave={handleSave} />

      <Stack>
        <Divider label="站点信息" labelPosition="left" />
        <TextInput
          label="站点标题"
          placeholder="Publa"
          value={settings.siteTitle || ''}
          onChange={(e) => setField('siteTitle', e.target.value)}
        />
        <TextInput
          label="站点 Slogan"
          placeholder="Yet Another Amazing Blog"
          value={settings.siteSlogan || ''}
          onChange={(e) => setField('siteSlogan', e.target.value)}
        />
        <TextInput
          label="站点描述"
          value={settings.siteDescription || ''}
          onChange={(e) => setField('siteDescription', e.target.value)}
        />
        <TextInput
          label="站点 URL"
          description="如 https://www.example.com，结尾不带斜杠，在生成 RSS 和 Atom 链接等场景会用到"
          placeholder="https://example.com"
          value={settings.siteUrl || ''}
          onChange={(e) => setField('siteUrl', e.target.value)}
        />

        <Divider label="站点图标" labelPosition="left" mt="md" />
        <Group align="flex-start" wrap="nowrap">
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              当前预览
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
                alt="站点图标预览"
                width={32}
                height={32}
                style={{ display: 'block' }}
              />
            </div>
            <Text size="xs" c="dimmed">
              当前模式：{faviconModeLabel}
            </Text>
          </Stack>

          <Stack gap="xs" style={{ flex: 1 }}>
            <TextInput
              label="图标外链 URL"
              description="仅支持 https:// 地址。应用后会通过站内 /favicon.ico 做统一出口。"
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
                应用 URL
              </Button>
              <Button
                component="label"
                variant="default"
                loading={faviconAction === 'upload'}
                disabled={faviconAction !== null && faviconAction !== 'upload'}
              >
                上传图标
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
                恢复默认
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              支持 ICO、PNG、SVG、WEBP，最大 256KB。上传或应用后立即生效。
            </Text>
          </Stack>
        </Group>

        <Divider label="评论设置" labelPosition="left" mt="md" />
        <Switch
          label="全局显示评论列表"
          description="关闭后，全站所有文章都不显示已有评论列表"
          checked={settings.showCommentsGlobally === 'true'}
          onChange={(e) =>
            setField('showCommentsGlobally', e.currentTarget.checked ? 'true' : 'false')
          }
        />
        <Switch
          label="全局启用评论"
          description="关闭后，全站所有文章都不允许提交新评论"
          checked={settings.enableComment === 'true'}
          disabled={settings.showCommentsGlobally === 'false'}
          onChange={(e) => setField('enableComment', e.currentTarget.checked ? 'true' : 'false')}
        />
        <Switch
          label="评论默认通过审核"
          checked={settings.defaultApprove === 'true'}
          onChange={(e) => setField('defaultApprove', e.currentTarget.checked ? 'true' : 'false')}
        />

        <Divider label="留言设置" labelPosition="left" mt="md" />
        <Switch
          label="启用留言板"
          description={<>留言板路径：/guestbook</>}
          checked={settings.enableGuestbook === 'true'}
          onChange={(e) => setField('enableGuestbook', e.currentTarget.checked ? 'true' : 'false')}
        />
        <TextInput
          label="留言板欢迎语"
          placeholder="欢迎给我留言！"
          value={settings.guestbookWelcome || ''}
          onChange={(e) => setField('guestbookWelcome', e.target.value)}
        />

        <Divider label="RSS 设置" labelPosition="left" mt="md" />
        <Radio.Group
          label="RSS 输出内容"
          value={settings.rssContent || 'full'}
          onChange={(v) => setField('rssContent', v)}
        >
          <Group mt="xs">
            <Radio value="full" label="全文" />
            <Radio value="excerpt" label="摘要" />
          </Group>
        </Radio.Group>
        <NumberInput
          label="RSS 条数"
          min={1}
          max={100}
          value={parseInt(settings.rssLimit || '10')}
          onChange={(v) => setField('rssLimit', String(v || 10))}
          style={{ width: 120 }}
        />

        <Divider label="搜索设置" labelPosition="left" mt="md" />
        <Switch
          label="启用搜索"
          description="关闭后，页脚的搜索框将不再显示"
          checked={settings.enableSearch === 'true'}
          onChange={(e) => setField('enableSearch', e.currentTarget.checked ? 'true' : 'false')}
        />

        <Divider label="底部版权" labelPosition="left" mt="md" />
        <Textarea
          label="底部版权信息"
          placeholder="{SITE_NAME} &copy; {FULL_YEAR}"
          description="支持 HTML，可用 {SITE_NAME} 引用站点名，{FULL_YEAR} 引用当前年份"
          autosize
          minRows={2}
          value={settings.footerCopyright || ''}
          onChange={(e) => setField('footerCopyright', e.target.value)}
          styles={{ input: { maxHeight: 400, overflow: 'auto' } }}
        />

        <Divider label="自定义 HTML" labelPosition="left" mt="md" />
        <Textarea
          label="文章末尾自定义 HTML"
          description="显示在每篇文章内容之后，可用于放置广告代码等"
          placeholder="<div>...</div>"
          autosize
          minRows={3}
          value={settings.customAfterPostHtml || ''}
          onChange={(e) => setField('customAfterPostHtml', e.target.value)}
          styles={{ input: { fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' } }}
        />
        <Textarea
          label="自定义 Head HTML"
          description="在 </head> 标签前方插入 HTML，仅支持 <script>、<meta>、<link>、<style> 标签"
          placeholder="<script>...</script>"
          autosize
          minRows={3}
          value={settings.customHeadHtml || ''}
          onChange={(e) => setField('customHeadHtml', e.target.value)}
          styles={{ input: { fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' } }}
        />
        <Textarea
          label="自定义 Body 头部 HTML"
          description="在 <body> 标签后方插入 HTML"
          placeholder="<script>...</script>"
          autosize
          minRows={3}
          value={settings.customBodyStartHtml || ''}
          onChange={(e) => setField('customBodyStartHtml', e.target.value)}
          styles={{ input: { fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' } }}
        />
        <Textarea
          label="自定义 Body 底部 HTML"
          description="在 </body> 标签前方插入 HTML"
          placeholder="<script>...</script>"
          autosize
          minRows={3}
          value={settings.customBodyEndHtml || ''}
          onChange={(e) => setField('customBodyEndHtml', e.target.value)}
          styles={{ input: { fontFamily: 'monospace', maxHeight: 400, overflow: 'auto' } }}
        />
      </Stack>
    </Box>
  )
}
