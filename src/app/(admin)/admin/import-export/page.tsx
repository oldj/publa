'use client'

import { useAdminCounts, useCurrentUser } from '@/app/(admin)/_components/AdminCountsContext'
import { useAdminUrl } from '@/app/(admin)/_components/AdminPathContext'
import myModal from '@/app/(admin)/_components/myModals'
import { ensureReauth, sensitiveJsonFetch } from '@/app/(admin)/_lib/sensitive-fetch'
import { SafeDrawer } from '@/components/SafeDrawer'
import { notify } from '@/lib/notify'
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  List,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconDownload, IconEye, IconUpload } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type DataType = 'content' | 'settings'

interface ImportFile {
  name: string
  type: DataType
  data: any
}

interface BlockImportState {
  file: ImportFile | null
  importing: boolean
  results: string[]
}

interface DataBlockProps {
  type: DataType
  title: string
  description: string
  extraNote?: string
  actionsDisabled?: boolean
  state: BlockImportState
  onExport: () => void
  onSelectFile: () => void
  onImport: (mode: 'overwrite' | 'merge') => void
}

function DataBlock({
  type,
  title,
  description,
  extraNote,
  actionsDisabled = false,
  state,
  onExport,
  onSelectFile,
  onImport,
}: DataBlockProps) {
  const t = useTranslations('admin.importExportPage')
  const tCommon = useTranslations('common')

  return (
    <Paper withBorder p="md">
      <Text fw={500} mb="sm">
        {title}
      </Text>
      <Text size="sm" c="dimmed" mb={extraNote ? 'xs' : 'md'}>
        {t('containsPrefix')}
        {description}
      </Text>
      {extraNote && (
        <Text size="sm" c="orange" mb="md">
          {t('notePrefix')}
          {extraNote}
        </Text>
      )}

      <Group>
        <Button
          leftSection={<IconDownload size={16} />}
          onClick={onExport}
          disabled={actionsDisabled}
        >
          {tCommon('actions.export')}
        </Button>
        <Button
          variant="light"
          leftSection={<IconUpload size={16} />}
          onClick={onSelectFile}
          disabled={actionsDisabled}
        >
          {tCommon('actions.import')}
        </Button>
      </Group>

      {state.file && (
        <div style={{ marginTop: 16 }}>
          <Divider mb="sm" />
          <Group gap="sm" mb="md">
            <Text size="sm">{t('selectedFile', { name: state.file.name })}</Text>
            <Badge variant="light">{t(`typeLabels.${state.file.type}` as never)}</Badge>
          </Group>
          <Group>
            <Button
              onClick={() => onImport('overwrite')}
              loading={state.importing}
              color="orange"
              disabled={actionsDisabled}
            >
              {t('buttons.overwriteImport')}
            </Button>
            {type === 'content' && (
              <Button disabled title={t('mergeImportComingSoon')}>
                {t('buttons.mergeImport')}
              </Button>
            )}
          </Group>
        </div>
      )}

      {state.results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Divider mb="sm" />
          <Text size="sm" fw={500} mb="xs">
            {t('resultTitle')}
          </Text>
          <List size="sm">
            {state.results.map((r, i) => (
              <List.Item key={i}>{r}</List.Item>
            ))}
          </List>
        </div>
      )}
    </Paper>
  )
}

export default function ImportExportPage() {
  const t = useTranslations('admin.importExportPage')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const adminUrl = useAdminUrl()
  const currentUser = useCurrentUser()
  const { refreshCounts } = useAdminCounts()
  const [importStates, setImportStates] = useState<Record<DataType, BlockImportState>>({
    content: { file: null, importing: false, results: [] },
    settings: { file: null, importing: false, results: [] },
  })

  const updateImportState = (type: DataType, patch: Partial<BlockImportState>) => {
    setImportStates((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...patch },
    }))
  }

  // 数据格式文档
  const [formatHtml, setFormatHtml] = useState('')
  const [formatOpened, setFormatOpened] = useState(false)

  useEffect(() => {
    if (currentUser && !['owner', 'admin'].includes(currentUser.role)) {
      router.replace(adminUrl())
    }
  }, [currentUser, router, adminUrl])

  if (!currentUser || !['owner', 'admin'].includes(currentUser.role)) {
    return null
  }

  const canManageType = (type: DataType) => type === 'content' || currentUser.role === 'owner'

  const handleExport = async (type: 'content' | 'settings') => {
    if (!canManageType(type)) return

    const message = type === 'content' ? t('confirm.exportContent') : t('confirm.exportSettings')
    const confirmed = await myModal.confirm({ message })
    if (!confirmed) return
    // 仅 settings 导出需要二次验证，content 导出仅是后台可见内容的备份
    if (type === 'settings' && !(await ensureReauth())) return
    window.open(`/api/import-export?type=${type}`, '_blank')
  }

  const handleSelectFile = (expectedType: DataType) => {
    if (!canManageType(expectedType)) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data?.meta?.type || !['content', 'settings'].includes(data.meta.type)) {
          notify({ color: 'red', message: t('messages.invalidFileFormat') })
          return
        }

        if (data.meta.type !== expectedType) {
          notify({
            color: 'red',
            message: t('messages.wrongFileType', {
              type: t(`typeLabels.${data.meta.type as DataType}` as never),
            }),
          })
          return
        }

        updateImportState(expectedType, {
          file: { name: file.name, type: data.meta.type, data },
          results: [],
        })
      } catch {
        notify({ color: 'red', message: t('messages.parseFailed') })
      }
    }
    input.click()
  }

  const handleImport = async (mode: 'overwrite' | 'merge', type: DataType) => {
    if (!canManageType(type)) return

    const file = importStates[type].file
    if (!file) return

    const typeText = t(`typeLabels.${type}` as never)
    if (mode === 'overwrite') {
      const confirmed = await myModal.confirm({
        message: t('confirm.overwriteImport', { type: typeText }),
      })
      if (!confirmed) return
    }

    updateImportState(type, { importing: true, results: [] })

    try {
      const res = await sensitiveJsonFetch('/api/import-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file.data),
      })
      const json = await res.json()

      if (json.success) {
        updateImportState(type, { importing: false, results: json.data.results })
        await refreshCounts()
        notify({ color: 'green', message: t('messages.importComplete') })
      } else {
        updateImportState(type, { importing: false })
        notify({ color: 'red', message: json.message || tCommon('errors.importFailed') })
      }
    } catch {
      updateImportState(type, { importing: false })
      notify({ color: 'red', message: tCommon('errors.importFailed') })
    }
  }

  const showFormat = async () => {
    if (!formatHtml) {
      const res = await fetch('/api/import-export/format')
      const json = await res.json()
      if (json.success) setFormatHtml(json.data.html)
    }
    setFormatOpened(true)
  }

  const downloadFormat = async () => {
    const res = await fetch('/api/import-export/format')
    const json = await res.json()
    if (!json.success) return
    const blob = new Blob([json.data.md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-export-format.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box mt="md">
      <Group justify="space-between" mb="lg">
        <Title order={3}>{t('title')}</Title>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEye size={14} />}
            onClick={showFormat}
          >
            {t('buttons.viewFormat')}
          </Button>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={downloadFormat}
          >
            {t('buttons.downloadDoc')}
          </Button>
        </Group>
      </Group>

      <Stack>
        {/* 内容数据 */}
        <DataBlock
          type="content"
          title={t('blocks.content.title')}
          description={t('blocks.content.description')}
          state={importStates.content}
          onExport={() => handleExport('content')}
          onSelectFile={() => handleSelectFile('content')}
          onImport={(mode) => handleImport(mode, 'content')}
        />

        {/* 设置数据 */}
        <DataBlock
          type="settings"
          title={t('blocks.settings.title')}
          description={t('blocks.settings.description')}
          extraNote={t('blocks.settings.extraNote')}
          actionsDisabled={!canManageType('settings')}
          state={importStates.settings}
          onExport={() => handleExport('settings')}
          onSelectFile={() => handleSelectFile('settings')}
          onImport={(mode) => handleImport(mode, 'settings')}
        />
      </Stack>

      {/* 数据格式文档 Drawer */}
      <SafeDrawer
        opened={formatOpened}
        onClose={() => setFormatOpened(false)}
        title={t('drawerTitle')}
        position="right"
        size="xl"
      >
        <ScrollArea h="calc(100vh - 100px)">
          <div className="format-doc" dangerouslySetInnerHTML={{ __html: formatHtml }} />
          <style>{`
            .format-doc { font-size: 14px; line-height: 1.7; color: var(--mantine-color-text); }
            .format-doc h1 { font-size: 1.4em; font-weight: 600; margin: 1.5em 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid var(--mantine-color-default-border); }
            .format-doc h2 { font-size: 1.2em; font-weight: 600; margin: 1.3em 0 0.5em; }
            .format-doc h3 { font-size: 1.05em; font-weight: 600; margin: 1.1em 0 0.4em; }
            .format-doc p { margin: 0.5em 0; }
            .format-doc ul, .format-doc ol { padding-left: 1.5em; margin: 0.4em 0; }
            .format-doc li { margin: 0.2em 0; }
            .format-doc code { font-size: 0.9em; padding: 0.15em 0.4em; border-radius: 4px; background: var(--mantine-color-default-hover); }
            .format-doc pre { margin: 0.6em 0; padding: 0.8em 1em; border-radius: 6px; background: var(--mantine-color-default-hover); overflow-x: auto; }
            .format-doc pre code { padding: 0; background: none; }
            .format-doc table { width: 100%; border-collapse: collapse; margin: 0.6em 0; font-size: 0.9em; }
            .format-doc th, .format-doc td { padding: 0.4em 0.8em; border: 1px solid var(--mantine-color-default-border); text-align: left; }
            .format-doc th { background: var(--mantine-color-default-hover); font-weight: 600; }
            .format-doc blockquote { margin: 0.5em 0; padding: 0.3em 1em; border-left: 3px solid var(--mantine-color-default-border); color: var(--mantine-color-dimmed); }
            .format-doc hr { border: none; border-top: 1px solid var(--mantine-color-default-border); margin: 1.2em 0; }
          `}</style>
        </ScrollArea>
      </SafeDrawer>
    </Box>
  )
}
